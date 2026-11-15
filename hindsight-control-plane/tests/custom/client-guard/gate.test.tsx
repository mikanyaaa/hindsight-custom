// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClientGuard } from "@/custom/client-guard/gate";
import { reportRequestTimeout, reportSessionExpired, resetGuardForTests } from "@/custom/client-guard/state";

vi.mock("next-intl", () => ({ useLocale: () => "de" }));

afterEach(() => {
  resetGuardForTests();
});

describe("ClientGuard", () => {
  it("shows the German session state and reloads only once", () => {
    const reload = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { reload } });
    render(<ClientGuard />);

    expect(screen.queryByRole("alertdialog")).toBeNull();
    act(() => {
      reportSessionExpired();
    });

    expect(screen.getByRole("heading", { name: "Sitzung abgelaufen" })).toBeTruthy();
    const button = screen.getByRole("button", { name: "Erneut anmelden" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("offers a retry for a timed-out request", () => {
    const retry = vi.fn();
    render(<ClientGuard />);
    act(() => {
      reportRequestTimeout(retry);
    });
    fireEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
