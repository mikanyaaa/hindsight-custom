"use client";

// CUSTOM-HOOK: home-quiet-paper-desk begin
import { HomeDesk } from "@/custom/home/home-desk";
// CUSTOM-HOOK: home-quiet-paper-desk end

export function HomeView({
  bankId,
  onNavigate,
}: {
  bankId: string;
  onNavigate: (tab: string) => void;
}) {
  return <HomeDesk bankId={bankId} onNavigate={onNavigate} />;
}
