/**
 * GC-Scouting - tierlist page
 *
 * Guide that explains how to build a tier list.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FilterIcon, LayersIcon, UsersIcon } from "lucide-react";
import type { AppLocale } from "@/i18n/routing";
import { TIERS } from "@/lib/tiers";
import { DEMO_POST } from "@/lib/demo-post";
import { TierListView } from "@/components/post/tier-list";
import { LegalCallout, LegalList, LegalPage, LegalSection, LegalText, legalRich } from "@/components/legal/legal-ui";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "tierListGuide" });
  return { title: t("title"), description: t("intro") };
}

export default async function TierListGuidePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations("tierListGuide");
  const tTiers = await getTranslations("tiers");

  return (
    <LegalPage title={t("title")} intro={t("intro")}>
      <LegalSection icon={UsersIcon} title={t("scene.title")}>
        <LegalText>{t.rich("scene.text", legalRich)}</LegalText>
        <LegalText>{t.rich("scene.credit", legalRich)}</LegalText>
        <LegalText>{t("scene.why")}</LegalText>
      </LegalSection>

      <LegalSection icon={LayersIcon} title={t("tiers.title")}>
        <ul className="flex flex-col gap-3">
          {TIERS.map((tier) => (
            <li key={tier.key} className="flex items-start gap-3">
              <span
                className="flex w-[112px] flex-none items-center justify-center rounded-md px-2 py-1.5 text-center text-[11.5px] leading-tight font-bold text-[#141414]"
                style={{ background: tier.color }}
              >
                {tTiers(tier.key)}
              </span>
              <p className="text-sm leading-relaxed text-neutral-400">{t(`tiers.${tier.key}`)}</p>
            </li>
          ))}
        </ul>
        <LegalText>{t("tiers.aside")}</LegalText>
      </LegalSection>

      <LegalSection icon={FilterIcon} title={t("highlight.title")}>
        <LegalText>{t.rich("highlight.text", legalRich)}</LegalText>
        <LegalList items={[t("highlight.honest"), t("highlight.notMeta"), t("highlight.filter")]} />
        <LegalCallout>{t("highlight.example")}</LegalCallout>
        {DEMO_POST.tierList && <TierListView tierList={DEMO_POST.tierList} />}
      </LegalSection>
    </LegalPage>
  );
}
