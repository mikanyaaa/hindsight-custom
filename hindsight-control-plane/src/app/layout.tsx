import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hindsight Control Plane",
  description: "Control plane for the temporal semantic memory system",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The root layout is a minimal shell. Locale-aware content,
  // providers, and <html lang> are handled in [locale]/layout.tsx.
  // CUSTOM-HOOK: theme-warm-glass-entry begin
  if (process.env.NEXT_PUBLIC_HINDSIGHT_THEME_WARM_GLASS === "true") {
    return import("@/custom/theme/layer").then(({ default: Layer }) => <Layer>{children}</Layer>);
  }
  // CUSTOM-HOOK: theme-warm-glass-entry end
  return children;
}
