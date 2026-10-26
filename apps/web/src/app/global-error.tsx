/**
 * GC-Scouting - global-error
 *
 * Last resort error boundary, renders outside the locale layout.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useEffect, useTransition } from "react";
import { usePathname } from "next/navigation";
import { hasLocale } from "next-intl";
import { routing, type AppLocale } from "@/i18n/routing";
import "./globals.css";

// Shown when the root layout itself fails, so without the intl provider: the message files are too large to bundle here.
const TEXTS: Record<AppLocale, { title: string; body: string; retry: string; back: string }> = {
  en: { title: "Something went wrong", body: "This page couldn't load. Try again in a moment.", retry: "Try again", back: "Browse posts" },
  fr: { title: "Une erreur est survenue", body: "Cette page n'a pas pu se charger. Réessaie dans un instant.", retry: "Réessayer", back: "Voir les annonces" },
  es: { title: "Algo salió mal", body: "Esta página no se pudo cargar. Inténtalo de nuevo en un momento.", retry: "Reintentar", back: "Ver los anuncios" },
  pt: { title: "Algo correu mal", body: "Esta página não pôde ser carregada. Tenta novamente daqui a pouco.", retry: "Tentar novamente", back: "Ver os anúncios" },
  tr: { title: "Bir şeyler ters gitti", body: "Bu sayfa yüklenemedi. Biraz sonra tekrar dene.", retry: "Tekrar dene", back: "İlanlara göz at" },
  ja: { title: "問題が発生しました", body: "このページを読み込めませんでした。しばらくしてからもう一度お試しください。", retry: "再試行", back: "募集を見る" },
  ko: { title: "문제가 발생했습니다", body: "이 페이지를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", retry: "다시 시도", back: "공고 보기" },
  de: { title: "Etwas ist schiefgelaufen", body: "Diese Seite konnte nicht geladen werden. Versuche es gleich noch einmal.", retry: "Erneut versuchen", back: "Anzeigen ansehen" },
  zh: { title: "出了点问题", body: "此页面无法加载，请稍后再试。", retry: "重试", back: "浏览帖子" },
  it: { title: "Qualcosa è andato storto", body: "Impossibile caricare questa pagina. Riprova tra un attimo.", retry: "Riprova", back: "Vedi gli annunci" },
  pl: { title: "Coś poszło nie tak", body: "Nie udało się załadować tej strony. Spróbuj ponownie za chwilę.", retry: "Spróbuj ponownie", back: "Przeglądaj ogłoszenia" },
  ar: { title: "حدث خطأ ما", body: "تعذر تحميل هذه الصفحة. حاول مرة أخرى بعد قليل.", retry: "إعادة المحاولة", back: "تصفح الإعلانات" },
  th: { title: "เกิดข้อผิดพลาดบางอย่าง", body: "ไม่สามารถโหลดหน้านี้ได้ โปรดลองอีกครั้งในอีกสักครู่", retry: "ลองอีกครั้ง", back: "ดูประกาศ" },
};

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const segment = usePathname()?.split("/")[1];
  const locale = hasLocale(routing.locales, segment) ? segment : routing.defaultLocale;
  const t = TEXTS[locale];
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col items-center justify-center bg-[var(--sc-bg)] px-4 text-center font-sans text-[var(--sc-text)] antialiased">
        <title>{t.title}</title>
        <p className="font-mono text-[13px] font-black tracking-widest text-[var(--sc-accent)]">500</p>
        <h1 className="mt-2 text-[24px] font-bold tracking-tight text-neutral-50">{t.title}</h1>
        <p className="mt-2 text-[14.5px] text-neutral-500">{t.body}</p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(retry)}
            className="inline-flex h-11 cursor-pointer items-center rounded-[11px] bg-[var(--sc-accent)] px-5 text-[14.5px] font-bold text-[var(--sc-accent-ink)] transition-all hover:brightness-110 active:scale-[0.97] disabled:cursor-wait disabled:opacity-70"
          >
            {t.retry}
          </button>
          <a
            href={`/${locale}/posts`}
            className="inline-flex h-11 items-center rounded-[11px] border border-neutral-800 bg-[var(--sc-surface)] px-5 text-[14.5px] font-semibold text-neutral-200 transition-all hover:bg-[var(--sc-hover)] active:scale-[0.97]"
          >
            {t.back}
          </a>
        </div>
      </body>
    </html>
  );
}
