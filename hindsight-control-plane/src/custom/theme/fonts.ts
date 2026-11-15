import localFont from "next/font/local";

/* Latin variable subsets, checked in so the build never downloads fonts.
   next/font reads the files and emits a size-adjusted Arial fallback
   (size-adjust, ascent-override, descent-override) so the swap does not move text. */
export const geistSans = localFont({
  src: "./fonts/geist-sans-latin.woff2",
  weight: "100 900",
  display: "swap",
  adjustFontFallback: "Arial",
  variable: "--font-sans",
  fallback: ["Arial", "sans-serif"],
  preload: true,
});

export const geistMono = localFont({
  src: "./fonts/geist-mono-latin.woff2",
  weight: "100 900",
  display: "swap",
  adjustFontFallback: "Arial",
  variable: "--font-mono",
  fallback: ["Arial", "sans-serif"],
  preload: false,
});
