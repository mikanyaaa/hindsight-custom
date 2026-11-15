import { cookies } from "next/headers";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { BankProvider } from "@/lib/bank-context";
import { FeaturesProvider } from "@/lib/features-context";
import { ThemeProvider } from "@/lib/theme-context";
import { Toaster } from "@/components/ui/sonner";
// CUSTOM-HOOK: theme-quiet-paper-fonts begin
import { geistMono, geistSans } from "@/custom/theme/fonts";
import { THEME_COOKIE, THEME_INIT_SCRIPT, themeFromCookie } from "@/custom/theme/init";
// CUSTOM-HOOK: theme-quiet-paper-fonts end
// CUSTOM-HOOK: frame-quiet-paper-seed begin
import { SIDEBAR_COOKIE, sidebarCollapsedFromCookie } from "@/custom/frame/sidebar-state";
import { SidebarCollapsedProvider } from "@/custom/frame/sidebar-provider";
// CUSTOM-HOOK: frame-quiet-paper-seed end
// CUSTOM-HOOK: client-guard-entry begin
import { ClientGuard } from "@/custom/client-guard/gate";
// CUSTOM-HOOK: client-guard-entry end

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  // CUSTOM-HOOK: theme-quiet-paper-boot begin
  const storedTheme = themeFromCookie((await cookies()).get(THEME_COOKIE)?.value);
  // CUSTOM-HOOK: theme-quiet-paper-boot end
  const sidebarCollapsed = sidebarCollapsedFromCookie((await cookies()).get(SIDEBAR_COOKIE)?.value);

  return (
    <html
      lang={locale}
      data-theme="quiet-paper"
      className={`${geistSans.variable} ${geistMono.variable}${storedTheme === "dark" ? " dark" : ""}`}
      suppressHydrationWarning
    >
      {/* Parser-blocking. The renderer nests this at the start of body; it still
          runs before the rest of the body is parsed, so the first paint has .dark. */}
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <body className="bg-background text-foreground">
        <SidebarCollapsedProvider collapsed={sidebarCollapsed}>
          <ThemeProvider initialTheme={storedTheme ?? "light"}>
            <FeaturesProvider>
              <BankProvider>
                <NextIntlClientProvider>
                  {children}
                  {/* CUSTOM-HOOK: client-guard-mount begin */}
                  <ClientGuard />
                  {/* CUSTOM-HOOK: client-guard-mount end */}
                </NextIntlClientProvider>
              </BankProvider>
            </FeaturesProvider>
          </ThemeProvider>
        </SidebarCollapsedProvider>
        <Toaster />
      </body>
    </html>
  );
}
