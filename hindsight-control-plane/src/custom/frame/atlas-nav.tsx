"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronDown, Moon, MoreHorizontal, Plus, Search, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { client } from "@/lib/api";
import { bankRoute } from "@/lib/bank-url";
import { CommandPalette } from "@/custom/frame/command-palette";
import { useFrameCopy, useFrameLabel } from "@/custom/frame/labels";
import { MORE_NAV, PRIMARY_NAV, type FrameView } from "@/custom/frame/nav";

function AtlasNavigation({
  bankId,
  currentTab,
  actions,
  triggerRef,
}: {
  bankId: string;
  currentTab: FrameView;
  actions: ReactNode;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const tNav = useTranslations("nav");
  const copy = useFrameCopy();
  const label = useFrameLabel();
  const [apiVersion, setApiVersion] = useState<string | null>(null);
  const moreCurrent = MORE_NAV.some((item) => item.id === currentTab);

  useEffect(() => {
    let active = true;
    client
      .getVersion()
      .then((version) => {
        if (active) setApiVersion(version.api_version);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <nav className="atlas-bank-nav atlas-glass" aria-label={copy.navigation}>
      <ul className="atlas-bank-nav-items">
        {PRIMARY_NAV.map(({ id, icon: Icon }) => (
          <li key={id}>
            <Link
              href={bankRoute(bankId, `?view=${id}`)}
              aria-current={id === currentTab ? "page" : undefined}
              className="atlas-nav-item"
            >
              <Icon aria-hidden="true" />
              <span>{label(id)}</span>
            </Link>
          </li>
        ))}
        <li>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild ref={triggerRef}>
              <button
                type="button"
                className="atlas-nav-item"
                aria-current={moreCurrent ? "page" : undefined}
              >
                <MoreHorizontal aria-hidden="true" />
                <span>{tNav("more")}</span>
                <ChevronDown className="atlas-nav-chevron" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={12} className="min-w-56">
              {MORE_NAV.map(({ id, icon: Icon }) => (
                <DropdownMenuItem key={id} asChild>
                  <Link
                    href={bankRoute(bankId, `?view=${id}`)}
                    aria-current={id === currentTab ? "page" : undefined}
                    className="aria-[current=page]:bg-accent"
                  >
                    <Icon aria-hidden="true" />
                    {label(id)}
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {actions}
              {apiVersion && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="font-normal text-muted-foreground">
                    Hindsight v{apiVersion}
                  </DropdownMenuLabel>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      </ul>
    </nav>
  );
}

export function AtlasBankActions({
  bankId,
  currentTab,
  addDocumentLabel,
  addDocumentTitle,
  onAddDocument,
  accountItems,
}: {
  bankId: string | null;
  currentTab: FrameView;
  addDocumentLabel: string;
  addDocumentTitle: string;
  onAddDocument: (trigger: HTMLElement | null) => void;
  accountItems: ReactNode;
}) {
  const copy = useFrameCopy();
  const desktopMore = useRef<HTMLButtonElement>(null);
  const mobileActions = useRef<HTMLButtonElement>(null);

  return (
    <CommandPalette
      renderTrigger={(openPalette) => {
        const paletteItem = (trigger: RefObject<HTMLButtonElement | null>) => (
          <DropdownMenuItem
            onSelect={() => openPalette(trigger.current)}
            aria-keyshortcuts="Control+K Meta+K"
          >
            <Search aria-hidden="true" />
            {copy.paletteLabel}
          </DropdownMenuItem>
        );
        return (
          <>
            {bankId && (
              <>
                <AtlasNavigation
                  bankId={bankId}
                  currentTab={currentTab}
                  triggerRef={desktopMore}
                  actions={
                    <>
                      <DropdownMenuItem
                        onSelect={() => onAddDocument(desktopMore.current)}
                        data-add-document
                      >
                        <Plus aria-hidden="true" />
                        {addDocumentLabel}
                      </DropdownMenuItem>
                      {paletteItem(desktopMore)}
                      {accountItems}
                    </>
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="atlas-mobile-action"
                  onClick={(event) => onAddDocument(event.currentTarget)}
                  title={addDocumentTitle}
                  aria-label={addDocumentLabel}
                  data-add-document
                >
                  <Plus className="h-5 w-5" aria-hidden="true" />
                </Button>
              </>
            )}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild ref={mobileActions}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="atlas-mobile-action"
                  aria-label={copy.actions}
                  title={copy.actions}
                >
                  <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56">
                {paletteItem(mobileActions)}
                {accountItems}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        );
      }}
    />
  );
}

export function AtlasThemeSwitch({
  theme,
  toggleTheme,
}: {
  theme: "light" | "dark";
  toggleTheme: () => void;
}) {
  const tNav = useTranslations("nav");
  const alternateLabel = theme === "light" ? tNav("darkMode") : tNav("lightMode");

  return (
    <div className="atlas-theme-switch atlas-glass">
      <button
        type="button"
        className="atlas-theme-toggle"
        aria-label={alternateLabel}
        title={alternateLabel}
        onClick={toggleTheme}
      >
        {theme === "light" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
      </button>
      {(
        [
          ["light", Sun, tNav("lightMode")],
          ["dark", Moon, tNav("darkMode")],
        ] as const
      ).map(([mode, Icon, label]) => (
        <button
          key={mode}
          type="button"
          className="atlas-theme-option"
          aria-label={label}
          title={label}
          aria-pressed={theme === mode}
          onClick={() => {
            if (theme !== mode) toggleTheme();
          }}
        >
          <Icon aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
