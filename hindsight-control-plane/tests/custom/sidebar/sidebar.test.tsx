// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/lib/bank-context", () => ({ useBank: () => ({ currentBank: "test-bank" }) }));
vi.mock("@/lib/api", () => ({ client: { getVersion: async () => ({ api_version: "test" }) } }));
// A native anchor lets us assert cancellation without Next's own click machinery.
vi.mock("next/link", () => ({
  default: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}));
const { Sidebar } = await import("@/components/sidebar");
afterEach(cleanup);

async function setup() {
  const navigate = vi.fn();
  render(<Sidebar currentTab="home" onTabChange={navigate} />);
  await waitFor(() => expect(screen.getByText("vtest")).toBeTruthy());
  return {
    navigate,
    rail: screen
      .getAllByRole("button", { name: "expandSidebar" })
      .find((node) => node.tagName === "ASIDE")!,
    link: screen.getByRole("link", { name: "memories" }),
  };
}
describe("sidebar links and existing toggle behavior", () => {
  it("names collapsed links and announces only the current page", async () => {
    await setup();
    expect(screen.getAllByRole("link")).toHaveLength(8);
    expect(screen.getByRole("link", { name: "home" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "memories" }).hasAttribute("aria-current")).toBe(false);
  });
  it("preserves chrome click, Enter, Space and explicit button toggles", async () => {
    const { rail, link, navigate } = await setup();
    fireEvent.click(rail);
    expect(rail.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(rail, { key: "Enter" });
    expect(rail.getAttribute("aria-expanded")).toBe("false");
    fireEvent.keyDown(rail, { key: " " });
    expect(rail.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(link, { key: "Enter" });
    expect(rail.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(link);
    expect(navigate).toHaveBeenCalledWith("data");
    expect(rail.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "collapse" }));
    expect(rail.getAttribute("aria-expanded")).toBe("false");
  });
  it.each(["ctrlKey", "metaKey", "shiftKey", "altKey", "middle"])(
    "leaves %s native without toggling",
    async (modifier) => {
      const { rail, link, navigate } = await setup();
      const event = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        ...(modifier === "middle" ? { button: 1 } : { [modifier]: true }),
      });
      fireEvent(link, event);
      expect(event.defaultPrevented).toBe(false);
      expect(navigate).not.toHaveBeenCalled();
      expect(rail.getAttribute("aria-expanded")).toBe("false");
    }
  );
});
