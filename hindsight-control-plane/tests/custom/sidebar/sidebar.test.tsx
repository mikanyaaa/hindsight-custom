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
  const rail = document.querySelector("aside");
  if (!rail) throw new Error("sidebar rail missing");
  return {
    navigate,
    rail,
    toggle: screen.getByRole("button", { name: "expandSidebar" }),
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
  it("preserves chrome click and the explicit toggle, and leaves the aside without a button role", async () => {
    const { rail, toggle, link, navigate } = await setup();
    // Upstream v1.2 keeps the aside as a mouse target and puts keyboard toggle on the button.
    expect(rail.getAttribute("role")).toBeNull();
    fireEvent.click(rail);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(link, { key: "Enter" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(link);
    expect(navigate).toHaveBeenCalledWith("data");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "collapseSidebar" }));
    expect(
      screen.getByRole("button", { name: "expandSidebar" }).getAttribute("aria-expanded")
    ).toBe("false");
  });
  it.each(["ctrlKey", "metaKey", "shiftKey", "altKey", "middle"])(
    "leaves %s native without toggling",
    async (modifier) => {
      const { toggle, link, navigate } = await setup();
      const event = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        ...(modifier === "middle" ? { button: 1 } : { [modifier]: true }),
      });
      fireEvent(link, event);
      expect(event.defaultPrevented).toBe(false);
      expect(navigate).not.toHaveBeenCalled();
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
    }
  );
});
