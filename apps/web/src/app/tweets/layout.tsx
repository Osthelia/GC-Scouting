/**
 * GC-Scouting - tweets layout
 *
 * Layout of the tweet queue, restricted to the tweet account.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { Instrument_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { tweetsLocale } from "./locale";
import "../globals.css";

// Own root layout: no locale in the path, no site header (its links and cookies are useless behind the proxy).

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export default async function TweetsLayout({ children }: { children: React.ReactNode }) {
  const locale = await tweetsLocale();
  setRequestLocale(locale);
  const messages = (await import(`../../messages/${locale}.json`)).default;

  return (
    <html lang={locale} className={instrumentSans.variable} data-scroll-behavior="smooth">
      <body className="min-h-screen bg-[var(--sc-bg)] font-sans text-[15px] text-[var(--sc-text)] antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
