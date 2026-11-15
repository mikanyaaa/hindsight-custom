"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { bankRoute } from "@/lib/bank-url";
import { useBank } from "@/lib/bank-context";
import { useTheme } from "@/lib/theme-context";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FRAME_NAV } from "@/custom/frame/nav";
import { useFrameCopy, useFrameLabel } from "@/custom/frame/labels";

export function CommandPalette() {
  const copy = useFrameCopy();
  const label = useFrameLabel();
  const tNav = useTranslations("nav");
  const { currentBank } = useBank();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || event.repeat) return;
      if (!event.metaKey && !event.ctrlKey) return;
      event.preventDefault();
      setOpen((value) => !value);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-keyshortcuts="Control+K Meta+K"
        aria-label={copy.paletteLabel}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-[10px] border border-border bg-card px-0 text-sm text-muted-foreground hover:bg-accent hover:text-foreground sm:w-auto sm:min-w-44 sm:justify-start sm:px-3"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden truncate sm:inline">{copy.openPalette}</span>
        <kbd className="ml-auto hidden rounded-md border border-border px-1.5 py-0.5 font-mono text-[11px] md:inline">
          ⌘K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <DialogTitle className="sr-only">{copy.paletteLabel}</DialogTitle>
        <DialogDescription className="sr-only">{copy.placeholder}</DialogDescription>
        <CommandInput placeholder={copy.placeholder} />
        <CommandList>
          <CommandEmpty>{copy.empty}</CommandEmpty>
          {currentBank && (
            <CommandGroup heading={copy.pages}>
              {FRAME_NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.id}
                    value={`${label(item.id)} ${item.id}`}
                    onSelect={() => go(bankRoute(currentBank, `?view=${item.id}`))}
                  >
                    <Icon className="h-4 w-4" />
                    {label(item.id)}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
          <CommandGroup heading={copy.actions}>
            <CommandItem value={tNav("bank.allBanks")} onSelect={() => go("/dashboard")}>
              {tNav("bank.allBanks")}
            </CommandItem>
            <CommandItem
              value={theme === "light" ? tNav("darkMode") : tNav("lightMode")}
              onSelect={() => {
                toggleTheme();
                setOpen(false);
              }}
            >
              {theme === "light" ? tNav("darkMode") : tNav("lightMode")}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
