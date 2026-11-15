// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RequestTimeoutError, SessionExpiredError } from "@/custom/client-guard/browser-fetch";
import { reportSessionExpired, resetGuardForTests } from "@/custom/client-guard/state";
import { pageCopy } from "@/custom/pages/copy";
import { isPageFailure } from "@/custom/pages/failure";
import { PageEmpty, PageError, PageLoading } from "@/custom/pages/status";
import { locales } from "@/i18n/config";

vi.mock("next-intl", () => ({ useLocale: () => "de" }));

afterEach(() => {
  resetGuardForTests();
});

describe("page status", () => {
  it("has the same lines in every locale", () => {
    const keys = Object.keys(pageCopy.en).sort();
    for (const locale of locales) {
      expect(Object.keys(pageCopy[locale]).sort()).toEqual(keys);
      for (const value of Object.values(pageCopy[locale])) {
        expect(value.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("shows a loading label and an empty sentence", () => {
    render(<PageLoading label="Dokumente werden geladen" />);
    expect(screen.getByRole("status").textContent).toContain("Dokumente werden geladen");
    expect(screen.getAllByRole("status")).toHaveLength(1);

    render(<PageEmpty title="Keine Dokumente" detail="Noch nichts behalten." />);
    expect(screen.getByText("Keine Dokumente")).toBeTruthy();
    expect(screen.getByText("Noch nichts behalten.")).toBeTruthy();
  });

  it("offers a retry, and stays quiet once the session dialog owns the failure", () => {
    const retry = vi.fn();
    const { rerender } = render(<PageError onRetry={retry} />);
    expect(screen.getByRole("alert").textContent).toContain(
      "Diese Seite konnte nicht geladen werden."
    );
    fireEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(retry).toHaveBeenCalledTimes(1);

    act(() => {
      reportSessionExpired();
    });
    rerender(<PageError onRetry={retry} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("leaves session, timeout and cancelled reads to their own states", () => {
    expect(isPageFailure(new SessionExpiredError())).toBe(false);
    expect(isPageFailure(new RequestTimeoutError())).toBe(false);
    const aborted = new Error("aborted");
    aborted.name = "AbortError";
    expect(isPageFailure(aborted)).toBe(false);
    expect(isPageFailure(new Error("boom"))).toBe(true);
  });
});
