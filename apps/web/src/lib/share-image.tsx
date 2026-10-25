/**
 * GC-Scouting - share-image
 *
 * Renders the share image of a post and of the home page.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getTranslations } from "next-intl/server";
import { shareImageVersion, type ShareImagePost } from "@scouting/db/share-image";
import { POST_TYPE_BY_KEY, type PostType } from "@/lib/post-types";
import { REGION_COLOR } from "@/lib/regions";
import { RANK_BY_KEY, rankKey, type Rank } from "@/lib/ranks";
import { TIERS, groupByTier } from "@/lib/tiers";
import { AGENTS_BY_SLUG } from "@/lib/agents";
import { initials, postRankRange } from "@/lib/posts";
import { loggable } from "@scouting/db/log";
import { deleteObjects, getObject, putObject } from "@/lib/object-storage";

// Share image of a post (OG, Twitter, Discord), 1200x630, always in English.
// Stored in the object storage bucket when configured, rendered on each request otherwise.

export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 };

const LOCALE = "en";
const COLORS = { bg: "#0e0e0e", surface: "#161616", border: "#262626", text: "#f2f2f2", muted: "#9a9a9a", accent: "#9b7bff" };
const FONT = "Instrument Sans";
const PADDING = 32;
const HEADER_HEIGHT = 96;
const GAP = 18;
const TIER_LABEL_WIDTH = 190;
const ICON_GAP = 5;
const MIN_ICON_SIZE = 24;

/** Bytes of a file of `public/`. */
async function publicFile(file: string): Promise<ArrayBuffer> {
  const bytes = await readFile(path.join(process.cwd(), "public", file));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function dataUri(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i += 0x8000) binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return `data:image/png;base64,${btoa(binary)}`;
}

/** Null when the icon is missing, the caller draws a fallback. */
async function iconUri(file: string): Promise<string | null> {
  try {
    return dataUri(await publicFile(file));
  } catch {
    return null;
  }
}

let fontsPromise: Promise<NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"]> | null = null;

function loadFonts() {
  fontsPromise ??= Promise.all(
    (["latin", "latin-ext"] as const).flatMap((subset) =>
      ([500, 700] as const).map(async (weight) => ({
        name: FONT,
        data: await publicFile(`/og/fonts/instrument-sans-${subset}-${weight}.woff`),
        weight,
        style: "normal" as const,
      })),
    ),
  ).catch((error) => {
    fontsPromise = null;
    throw error;
  });
  return fontsPromise;
}

/** Largest icon size that fits the fullest tier row. */
function tierIconSize(maxAgents: number, width: number, height: number): number {
  for (let size = Math.floor(height); size > MIN_ICON_SIZE; size--) {
    const perLine = Math.max(1, Math.floor((width + ICON_GAP) / (size + ICON_GAP)));
    const lines = Math.max(1, Math.ceil(maxAgents / perLine));
    if (lines * (size + ICON_GAP) - ICON_GAP <= height) return size;
  }
  return MIN_ICON_SIZE;
}

function Chip({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 36,
        padding: "0 13px",
        borderRadius: 10,
        border: `1px solid ${COLORS.border}`,
        background: COLORS.surface,
        color: color ?? COLORS.text,
        fontSize: 19,
        fontWeight: 500,
      }}
    >
      {children}
    </div>
  );
}

function RankChip({ rank, icon, extra }: { rank: Rank; icon: string | null; extra?: string }) {
  return (
    <Chip>
      {icon ? <img src={icon} width={24} height={24} alt="" /> : null}
      <span style={{ color: RANK_BY_KEY[rank].color, fontWeight: 700 }}>{RANK_BY_KEY[rank].label}</span>
      {extra ? <span style={{ color: COLORS.muted }}>{extra}</span> : null}
    </Chip>
  );
}

function Brand({ scale = 1 }: { scale?: number }) {
  return (
    <div style={{ display: "flex", fontSize: 24 * scale, fontWeight: 700, color: COLORS.text, letterSpacing: -0.5 * scale }}>
      GC<span style={{ color: COLORS.accent, marginLeft: 6 * scale }}>Scouting</span>
    </div>
  );
}

async function ShareImage({ post }: { post: ShareImagePost }) {
  const [t, tTypes, tRegions, tRoles, tIgl, tStaff, tSpots, tTiers] = await Promise.all([
    getTranslations({ locale: LOCALE, namespace: "postPage" }),
    getTranslations({ locale: LOCALE, namespace: "home.types" }),
    getTranslations({ locale: LOCALE, namespace: "regions" }),
    getTranslations({ locale: LOCALE, namespace: "roles" }),
    getTranslations({ locale: LOCALE, namespace: "igl" }),
    getTranslations({ locale: LOCALE, namespace: "staffRoles" }),
    getTranslations({ locale: LOCALE, namespace: "rosterSpots" }),
    getTranslations({ locale: LOCALE, namespace: "tiers" }),
  ]);
  const type = POST_TYPE_BY_KEY[post.type as PostType];
  const regionColor = REGION_COLOR[post.region as keyof typeof REGION_COLOR] ?? COLORS.accent;
  const range = postRankRange(post);
  const peak = rankKey(post.rankPeak);
  const tierRows = post.tierList ? groupByTier(post.tierList) : null;

  const ranks = [range?.rank, range?.rankMax].filter((r): r is Rank => !!r);
  const agents = tierRows?.flat() ?? [];
  const [rankIcons, agentIcons] = await Promise.all([
    Promise.all(ranks.map((r) => iconUri(`/og/ranks/${r}.png`))),
    Promise.all(agents.map((slug) => iconUri(`/og/agents/${slug}.png`))),
  ]);
  const agentIcon = Object.fromEntries(agents.map((slug, i) => [slug, agentIcons[i]]));

  const tags = [
    ...post.roles.map((r) => tRoles(r as never)),
    ...post.igl.map((r) => tIgl(r as never)),
    ...post.staffRoles.map((r) => tStaff(r as never)),
  ];

  const contentWidth = SHARE_IMAGE_SIZE.width - 10 - PADDING * 2;
  const tierRowHeight = Math.floor((SHARE_IMAGE_SIZE.height - PADDING * 2 - HEADER_HEIGHT - GAP - 2) / TIERS.length);
  // Frame border (2), label column and row padding (20).
  const tierAreaWidth = contentWidth - 2 - TIER_LABEL_WIDTH - 20;
  const iconSize = tierRows ? tierIconSize(Math.max(...tierRows.map((row) => row.length)), tierAreaWidth, tierRowHeight - 12) : 0;
  const iconRadius = Math.max(6, Math.round(iconSize * 0.1));

  const chips = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      <Chip>
        <div style={{ display: "flex", width: 12, height: 12, borderRadius: 6, background: regionColor }} />
        {tRegions(post.region as never)}
      </Chip>
      {post.rosterSpot ? <Chip>{tSpots(post.rosterSpot as never)}</Chip> : null}
      {range ? (
        <RankChip
          rank={range.rank}
          icon={rankIcons[0] ?? null}
          extra={!range.rankMax && peak && post.rankCurrent !== null && post.rankPeak !== post.rankCurrent ? t("peak", { rank: RANK_BY_KEY[peak].label }) : undefined}
        />
      ) : null}
      {range?.rankMax ? <RankChip rank={range.rankMax} icon={rankIcons[1] ?? null} /> : null}
      {tags.length ? <Chip color={COLORS.muted}>{tags.join(" · ")}</Chip> : null}
    </div>
  );

  const typeBadge = (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
      <span style={{ fontSize: 20, color: COLORS.muted, fontWeight: 500 }}>{tTypes(`${type.key}.label`)}</span>
      <div style={{ display: "flex", padding: "6px 14px", borderRadius: 8, background: type.color, color: "#0e0e0e", fontSize: 24, fontWeight: 700 }}>{type.code}</div>
    </div>
  );

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", background: COLORS.bg, fontFamily: FONT, color: COLORS.text }}>
      <div style={{ display: "flex", width: 10, height: "100%", background: regionColor }} />
      {tierRows ? (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: PADDING, gap: GAP }}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: HEADER_HEIGHT }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
              <div style={{ display: "flex", fontSize: 46, fontWeight: 700, letterSpacing: -1.2, lineHeight: 1 }}>{post.displayName}</div>
              {typeBadge}
            </div>
            {chips}
          </div>

          <div style={{ display: "flex", flexDirection: "column", position: "relative", borderRadius: 14, border: `1px solid ${COLORS.border}`, background: COLORS.surface, overflow: "hidden" }}>
            {/* Watermark first: rows are transparent, agents are drawn over it. */}
            <div style={{ display: "flex", position: "absolute", top: 12, right: 14, opacity: 0.3 }}>
              <Brand scale={0.7} />
            </div>
            {TIERS.map((tier, i) => (
              <div key={tier.key} style={{ display: "flex", height: tierRowHeight, borderTop: i === 0 ? "none" : `1px solid ${COLORS.border}` }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: TIER_LABEL_WIDTH,
                    padding: "0 12px",
                    background: tier.color,
                    color: "#141414",
                    fontSize: 21,
                    fontWeight: 700,
                    textAlign: "center",
                    lineHeight: 1.1,
                  }}
                >
                  {tTiers(tier.key)}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", alignContent: "center", flex: 1, gap: ICON_GAP, padding: "5px 10px" }}>
                  {tierRows[i]!.map((slug) =>
                    agentIcon[slug] ? (
                      <img key={slug} src={agentIcon[slug]!} width={iconSize} height={iconSize} style={{ borderRadius: iconRadius }} alt="" />
                    ) : (
                      <div
                        key={slug}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: iconSize,
                          height: iconSize,
                          borderRadius: iconRadius,
                          background: COLORS.border,
                          color: COLORS.muted,
                          fontSize: Math.round(iconSize * 0.36),
                          fontWeight: 700,
                        }}
                      >
                        {initials(AGENTS_BY_SLUG[slug]?.name ?? slug)}
                      </div>
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: 44 }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>{typeBadge}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
            <div style={{ display: "flex", fontSize: 92, fontWeight: 700, letterSpacing: -3, lineHeight: 1 }}>{post.displayName}</div>
            {chips}
          </div>
          <Brand />
        </div>
      )}
    </div>
  );
}

/** PNG bytes of the share image. */
async function renderShareImage(post: ShareImagePost): Promise<ArrayBuffer> {
  const [element, fonts] = await Promise.all([ShareImage({ post }), loadFonts()]);
  const response = new ImageResponse(element, { ...SHARE_IMAGE_SIZE, fonts });
  return response.arrayBuffer();
}

const imageKey = (postId: number) => `posts/${postId}.png`;

/** Stored image when it matches the post, otherwise rendered then stored. One object per post (`key`). */
export async function getShareImage(post: ShareImagePost, key = imageKey(post.id)): Promise<ArrayBuffer> {
  const version = shareImageVersion(post);
  try {
    const stored = await getObject(key);
    if (stored?.metadata.version === version) return stored.bytes.slice().buffer;
  } catch (error) {
    console.error("Share image read failed", key, loggable(error));
  }

  const png = await renderShareImage(post);
  try {
    await putObject(key, png, "image/png", { version });
  } catch (error) {
    console.error("Share image write failed", key, loggable(error));
  }
  return png;
}

/** Drops the stored images of posts that are gone (removed, deleted account). Never throws. */
export async function deleteShareImages(postIds: number[]): Promise<void> {
  if (postIds.length === 0) return;
  try {
    await deleteObjects(postIds.map(imageKey));
  } catch (error) {
    console.error("Share image delete failed", postIds, loggable(error));
  }
}
