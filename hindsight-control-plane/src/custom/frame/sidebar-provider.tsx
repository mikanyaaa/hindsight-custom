"use client";

import { createContext, useContext } from "react";

const SidebarServerCollapsed = createContext(false);

/** The server snapshot. The live value after hydration comes from the cookie store. */
export function SidebarCollapsedProvider({
  collapsed,
  children,
}: {
  collapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <SidebarServerCollapsed.Provider value={collapsed}>{children}</SidebarServerCollapsed.Provider>
  );
}

export function useSidebarServerCollapsed(): boolean {
  return useContext(SidebarServerCollapsed);
}
