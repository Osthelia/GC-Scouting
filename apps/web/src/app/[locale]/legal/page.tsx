/**
 * GC-Scouting - legal page
 *
 * Legal notice page.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { CopyrightIcon, IdCardIcon, LibraryIcon, ScaleIcon, ServerIcon, ShieldCheckIcon } from "lucide-react";
import type { AppLocale } from "@/i18n/routing";
import { GCS_URL } from "@/lib/gcs";
import { LEGAL_CONTACT, LEGAL_UPDATED_AT, PRIVACY_CONTACT } from "@/lib/legal";
import { LegalCallout, LegalFields, LegalLink, LegalList, LegalPage, LegalSection, LegalText, legalRich } from "@/components/legal/legal-ui";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "legalNotice" });
  return { title: t("title") };
}

export default async function LegalNoticePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations("legalNotice");
  const format = await getFormatter();
  const updated = t("updated", { date: format.dateTime(LEGAL_UPDATED_AT, { dateStyle: "long" }) });

  return (
    <LegalPage title={t("title")} updated={updated}>
      <LegalSection icon={IdCardIcon} title={t("editor.title")}>
        <LegalFields
          fields={[
            { label: t("editor.identity"), value: "Osthelia" },
            { label: t("editor.status"), value: t("editor.statusValue") },
            { label: t("editor.email"), value: <LegalLink href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</LegalLink> },
            { label: t("editor.director"), value: "Alice Alleman" },
          ]}
        />
        <LegalText>{t("editor.ecosystem")}</LegalText>
      </LegalSection>

      <LegalSection icon={ServerIcon} title={t("hosting.title")}>
        <LegalFields
          fields={[
            { label: t("hosting.site"), value: "Cloudflare, Inc. (Workers, R2), 101 Townsend St, San Francisco, CA 94107, USA" },
            { label: t("hosting.database"), value: "Infomaniak Network SA (Public Cloud), Rue Eugène-Marziano 25, 1227 Les Acacias (GE), Switzerland" },
            { label: t("hosting.email"), value: t("hosting.emailValue") },
            { label: t("hosting.discord"), value: t("hosting.discordValue") },
          ]}
        />
      </LegalSection>

      <LegalSection icon={CopyrightIcon} title={t("property.title")}>
        <LegalText>{t("property.site")}</LegalText>
        <LegalText>{t("property.posts")}</LegalText>
        <LegalCallout>{t.rich("property.thirdParty", legalRich)}</LegalCallout>
        <LegalText>
          {t.rich("property.takedown", {
            ...legalRich,
            mail: (chunks) => <LegalLink href={`mailto:${LEGAL_CONTACT}`}>{chunks}</LegalLink>,
          })}
        </LegalText>
      </LegalSection>

      <LegalSection icon={ScaleIcon} title={t("rules.title")}>
        <LegalText>{t("rules.intro")}</LegalText>
        <LegalList items={[t("rules.truthful"), t("rules.respect"), t("rules.contact"), t("rules.ads")]} />
        <LegalText>{t("rules.moderation")}</LegalText>
      </LegalSection>

      <LegalSection icon={ShieldCheckIcon} title={t("privacy.title")}>
        <LegalText>
          {t.rich("privacy.text", {
            policy: (chunks) => <LegalLink href="/privacy">{chunks}</LegalLink>,
            mail: (chunks) => <LegalLink href={`mailto:${PRIVACY_CONTACT}`}>{chunks}</LegalLink>,
            email: PRIVACY_CONTACT,
          })}
        </LegalText>
      </LegalSection>

      <LegalSection icon={LibraryIcon} title={t("credits.title")}>
        <LegalList
          items={[
            t.rich("credits.gcs", { link: (chunks) => <LegalLink href={GCS_URL}>{chunks}</LegalLink> }),
            t.rich("credits.valorantApi", { link: (chunks) => <LegalLink href="https://valorant-api.com">{chunks}</LegalLink> }),
            t("credits.riot"),
          ]}
        />
      </LegalSection>
    </LegalPage>
  );
}
