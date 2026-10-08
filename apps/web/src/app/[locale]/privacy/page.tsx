/**
 * GC-Scouting - privacy page
 *
 * Privacy policy page.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { BellIcon, CookieIcon, EyeIcon, FlagIcon, KeyRoundIcon, LockIcon, MessageSquareIcon, ScaleIcon, Share2Icon, TimerIcon, UsersIcon } from "lucide-react";
import type { AppLocale } from "@/i18n/routing";
import { PRIVACY_CONTACT, LEGAL_UPDATED_AT } from "@/lib/legal";
import { LegalCallout, LegalLink, LegalList, LegalPage, LegalSection, LegalText, legalRich } from "@/components/legal/legal-ui";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "privacy" });
  return { title: t("title") };
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations("privacy");
  const format = await getFormatter();
  const updated = t("updated", { date: format.dateTime(LEGAL_UPDATED_AT, { dateStyle: "long" }) });
  const account = (chunks: React.ReactNode) => <LegalLink href="/account">{chunks}</LegalLink>;

  return (
    <LegalPage title={t("title")} intro={t("intro")} updated={updated}>
      <LegalSection icon={KeyRoundIcon} title={t("login.title")}>
        <LegalText>{t("login.text")}</LegalText>
        <LegalList
          items={[t.rich("login.identity", legalRich), t.rich("login.email", legalRich), t.rich("login.discord", legalRich), t.rich("login.player", legalRich), t.rich("login.created", legalRich), t.rich("login.sanctions", legalRich)]}
        />
        <LegalCallout>{t("login.tokens")}</LegalCallout>
      </LegalSection>

      <LegalSection icon={EyeIcon} title={t("public.title")}>
        <LegalText>{t("public.text")}</LegalText>
        <LegalCallout>{t.rich("public.contact", legalRich)}</LegalCallout>
        <LegalText>{t("public.gcs")}</LegalText>
      </LegalSection>

      <LegalSection icon={Share2Icon} title={t("relay.title")}>
        <LegalText>{t("relay.text")}</LegalText>
      </LegalSection>

      <LegalSection icon={LockIcon} title={t("private.title")}>
        <LegalList items={[t.rich("private.sessions", legalRich), t.rich("private.country", legalRich), t.rich("private.logs", legalRich)]} />
        <LegalText>{t("private.noTracking")}</LegalText>
      </LegalSection>

      <LegalSection icon={BellIcon} title={t("notifications.title")}>
        <LegalText>{t("notifications.text")}</LegalText>
      </LegalSection>

      <LegalSection icon={UsersIcon} title={t("delegation.title")}>
        <LegalText>{t("delegation.text")}</LegalText>
      </LegalSection>

      <LegalSection icon={MessageSquareIcon} title={t("messages.title")}>
        <LegalText>{t("messages.text")}</LegalText>
        <LegalCallout>{t("messages.staff")}</LegalCallout>
        <LegalList items={[t.rich("messages.automod", legalRich), t.rich("messages.links", legalRich), t.rich("messages.alerts", { ...legalRich, account })]} />
      </LegalSection>

      <LegalSection icon={FlagIcon} title={t("moderation.title")}>
        <LegalText>{t("moderation.text")}</LegalText>
        <LegalCallout>{t("moderation.reporter")}</LegalCallout>
      </LegalSection>

      <LegalSection icon={TimerIcon} title={t("retention.title")}>
        <LegalList items={[t("retention.posts"), t("retention.messages"), t("retention.sessions"), t.rich("retention.account", { account })]} />
      </LegalSection>

      <LegalSection icon={ScaleIcon} title={t("rights.title")}>
        <LegalText>{t.rich("rights.text", { account })}</LegalText>
        <LegalText>
          {t.rich("rights.contact", {
            mail: (chunks) => <LegalLink href={`mailto:${PRIVACY_CONTACT}`}>{chunks}</LegalLink>,
            email: PRIVACY_CONTACT,
          })}
        </LegalText>
      </LegalSection>

      <LegalSection icon={CookieIcon} title={t("cookies.title")}>
        <LegalText>{t("cookies.text")}</LegalText>
        <LegalList items={[t.rich("cookies.session", legalRich), t.rich("cookies.profile", legalRich), t.rich("cookies.oauth", legalRich), t.rich("cookies.theme", legalRich), t.rich("cookies.storage", legalRich)]} />
      </LegalSection>
    </LegalPage>
  );
}
