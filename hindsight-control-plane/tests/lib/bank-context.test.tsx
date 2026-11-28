// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { BankProvider, useBank } from "@/lib/bank-context";

const listBanks = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({ client: { listBanks } }));
vi.mock("next/navigation", () => ({ usePathname: () => "/banks/alpha" }));

function SelectedBank() {
  const { currentBank, currentBankName, setCurrentBank } = useBank();
  return (
    <>
      <h1>{currentBankName || currentBank}</h1>
      <button type="button" onClick={() => setCurrentBank("beta")}>
        Beta
      </button>
      <button type="button" onClick={() => setCurrentBank("gamma")}>
        Gamma
      </button>
    </>
  );
}

it("uses only the selected bank's name while an off-page lookup is pending", async () => {
  type LookupResponse = { banks: { bank_id: string; name: string }[] };
  let resolveBeta!: (value: LookupResponse) => void;
  const beta = new Promise<LookupResponse>((resolve) => {
    resolveBeta = resolve;
  });
  listBanks.mockImplementation(async ({ q }) => {
    if (q === "alpha") {
      return { banks: [{ bank_id: "alpha", name: "Alpha", display_alias: "Alpha alias" }] };
    }
    if (q === "beta") return beta;
    if (q === "gamma") return { banks: [{ bank_id: "gamma", name: "Gamma bank" }] };
    return { banks: [], total: 0 };
  });

  render(
    <BankProvider>
      <SelectedBank />
    </BankProvider>
  );

  await screen.findByRole("heading", { name: "Alpha alias" });
  fireEvent.click(screen.getByRole("button", { name: "Beta" }));
  expect(screen.getByRole("heading").textContent).toBe("beta");

  fireEvent.click(screen.getByRole("button", { name: "Gamma" }));
  await screen.findByRole("heading", { name: "Gamma bank" });
  await act(async () => resolveBeta({ banks: [{ bank_id: "beta", name: "Beta bank" }] }));
  expect(screen.getByRole("heading").textContent).toBe("Gamma bank");
});
