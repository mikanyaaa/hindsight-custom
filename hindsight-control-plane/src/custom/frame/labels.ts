"use client";

import { useLocale, useTranslations } from "next-intl";
import { frameCopyFor, type FrameCopy } from "@/custom/frame/copy";
import type { FrameView } from "@/custom/frame/nav";

export function useFrameCopy(): FrameCopy {
  return frameCopyFor(useLocale());
}

/** Page names already live in the shared catalogs, so every locale has them. */
export function useFrameLabel(): (id: FrameView) => string {
  const sidebar = useTranslations("bank.sidebar");
  const bank = useTranslations("bank");
  return (id) => {
    if (id === "profile") return bank("bankConfiguration");
    if (id === "data") return sidebar("memories");
    return sidebar(id);
  };
}
