/**
 * GC-Scouting - posts type page
 *
 * Post list of one type, with filters.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { listPosts } from "@/lib/posts-query";
import { isPostType } from "@/lib/post-types";
import { PostsBrowser } from "@/components/posts/posts-browser";
import { PostsSkeleton } from "@/components/posts/posts-skeleton";

type Params = Promise<{ locale: string; type: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, type } = await params;
  if (!isPostType(type)) return {};
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "home.types" });
  return { title: `${type.toUpperCase()} - ${t(`${type}.label`)}` };
}

export default async function PostTypePage({ params }: { params: Params }) {
  const { locale, type } = await params;
  if (!isPostType(type)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "home.types" });
  const posts = await listPosts({ type });

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-7 max-w-2xl">
        <h1 className="text-[28px] font-bold tracking-tight text-neutral-50 sm:text-[34px]">{t(`${type}.label`)}</h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-neutral-500">{t(`${type}.desc`)}</p>
      </div>
      {/* The filters read the URL on the client, so the list renders behind Suspense. */}
      <Suspense fallback={<PostsSkeleton />}>
        <PostsBrowser key={type} type={type} posts={posts} />
      </Suspense>
    </div>
  );
}
