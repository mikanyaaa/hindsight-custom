"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MoreHorizontal } from "lucide-react";
import { bankRoute } from "@/lib/bank-url";
import { useBank } from "@/lib/bank-context";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { MORE_NAV, PRIMARY_NAV, type FrameView } from "@/custom/frame/nav";
import { useFrameCopy, useFrameLabel } from "@/custom/frame/labels";

interface QuietTabBarProps {
  currentTab: FrameView;
  onTabChange: (tab: FrameView) => void;
}

export function QuietTabBar({ currentTab, onTabChange }: QuietTabBarProps) {
  const { currentBank } = useBank();
  const label = useFrameLabel();
  const copy = useFrameCopy();
  const tNav = useTranslations("nav");
  const [moreOpen, setMoreOpen] = useState(false);
  if (!currentBank) return null;

  const moreCurrent = MORE_NAV.some((item) => item.id === currentTab);
  const select = (id: FrameView) => {
    setMoreOpen(false);
    onTabChange(id);
  };

  return (
    <>
      <nav
        aria-label={copy.navigation}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid grid-cols-5">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            const current = currentTab === item.id;
            return (
              <li key={item.id}>
                <a
                  href={bankRoute(currentBank, `?view=${item.id}`)}
                  aria-current={current ? "page" : undefined}
                  aria-label={label(item.id)}
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    if (event.button !== 0) return;
                    event.preventDefault();
                    select(item.id);
                  }}
                  className={cn(
                    "flex min-h-11 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-xs",
                    current ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="max-w-full truncate">{label(item.id)}</span>
                </a>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              aria-label={copy.more}
              aria-current={moreCurrent ? "page" : undefined}
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen(true)}
              className={cn(
                "flex min-h-11 w-full flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-xs",
                moreCurrent ? "text-primary" : "text-muted-foreground"
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="max-w-full truncate">{tNav("more")}</span>
            </button>
          </li>
        </ul>
      </nav>
      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle>{tNav("more")}</DialogTitle>
          <DialogDescription className="sr-only">{tNav("more")}</DialogDescription>
          <ul className="flex flex-col gap-1">
            {MORE_NAV.map((item) => {
              const Icon = item.icon;
              const current = currentTab === item.id;
              return (
                <li key={item.id}>
                  <a
                    href={bankRoute(currentBank, `?view=${item.id}`)}
                    aria-current={current ? "page" : undefined}
                    onClick={(event) => {
                      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                      if (event.button !== 0) return;
                      event.preventDefault();
                      select(item.id);
                    }}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-sm",
                      current
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-accent"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {label(item.id)}
                  </a>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
