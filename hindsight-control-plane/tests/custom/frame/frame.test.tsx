// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { frameCopy } from "@/custom/frame/copy";
import { setSidebarCollapsed, sidebarCollapsedFromCookie } from "@/custom/frame/sidebar-state";

Element.prototype.scrollIntoView = () => {};

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

const push = vi.hoisted(() => vi.fn());
const toggleTheme = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({
  default: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));
vi.mock("@/lib/bank-context", () => ({ useBank: () => ({ currentBank: "atlas" }) }));
vi.mock("@/lib/theme-context", () => ({
  useTheme: () => ({ theme: "light", toggleTheme }),
}));
vi.mock("@/lib/api", () => ({
  client: { getVersion: () => Promise.resolve({ api_version: "1.0.0" }) },
}));

describe("frame copy", () => {
  it("gives every locale the same command-menu strings", () => {
    const keys = Object.keys(frameCopy.en).sort();
    for (const copy of Object.values(frameCopy)) {
      expect(Object.keys(copy).sort()).toEqual(keys);
      for (const value of Object.values(copy)) expect(value.length).toBeGreaterThan(0);
    }
  });
});

describe("bank frames", () => {
  beforeEach(() => {
    push.mockClear();
    toggleTheme.mockClear();
    setSidebarCollapsed(false);
  });

  it("opens the sidebar at 232px and collapses it", async () => {
    const { Sidebar } = await import("@/components/sidebar");
    render(<Sidebar drawer={false} currentTab="home" onTabChange={() => {}} />);
    const rail = document.querySelector("aside");
    expect(rail?.className).toContain("w-[232px]");
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "collapseSidebar" }));
    expect(document.querySelector("aside")?.className).toContain("w-16");
    expect(document.cookie).toContain("hs-sidebar=1");
    expect(sidebarCollapsedFromCookie("1")).toBe(true);
    expect(sidebarCollapsedFromCookie(undefined)).toBe(false);
  });

  it("offers the primary pages on a phone tab bar and the rest under More", async () => {
    const onTabChange = vi.fn();
    const { QuietTabBar } = await import("@/custom/frame/tab-bar");
    render(<QuietTabBar currentTab="home" onTabChange={onTabChange} />);
    expect(screen.getByRole("link", { name: "home" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getAllByRole("link")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "More pages" }));
    const reflect = screen.getByRole("link", { name: "reflect" });
    fireEvent.click(reflect);
    expect(onTabChange).toHaveBeenCalledWith("reflect");
  });

  it("shows the active desktop section and opens the remaining sections and actions with the keyboard", async () => {
    const { AtlasBankActions } = await import("@/custom/frame/atlas-nav");
    const addDocument = vi.fn();
    render(
      <AtlasBankActions
        bankId="atlas/2026"
        currentTab="data"
        addDocumentLabel="Add Document"
        addDocumentTitle="Add a document to this bank"
        onAddDocument={addDocument}
        accountItems={null}
      />
    );
    const nav = within(screen.getByRole("navigation", { name: "Sections" }));
    expect(nav.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "home",
      "recall",
      "memories",
      "pages",
    ]);
    expect(nav.getByRole("link", { name: "memories" }).getAttribute("aria-current")).toBe("page");
    expect(nav.getByRole("link", { name: "memories" }).getAttribute("href")).toBe(
      "/banks/atlas%2F2026?view=data"
    );

    const more = nav.getByRole("button", { name: "more" });
    fireEvent.keyDown(more, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "reflect" }).getAttribute("href")).toBe(
      "/banks/atlas%2F2026?view=reflect"
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Add Document" }));
    expect(addDocument).toHaveBeenCalledOnce();

    fireEvent.keyDown(more, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Open the command menu" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("opens the command menu with the keyboard and jumps to a page", async () => {
    const { CommandPalette } = await import("@/custom/frame/command-palette");
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("option", { name: "recall" }));
    expect(push).toHaveBeenCalledWith("/banks/atlas?view=recall");
  });
});
