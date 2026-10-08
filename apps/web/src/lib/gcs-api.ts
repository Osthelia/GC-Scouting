/**
 * GC-Scouting - gcs-api
 *
 * Typed client for the GC Stats API.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { z } from "zod";
import { gcsFetch } from "./auth/gcs-oauth";
import { GCS_URL } from "./gcs";

// GC Stats public API (v2), server only: the API key never reaches the browser.

export class GcsApiError extends Error {
  constructor(
    public readonly status: number,
    path: string,
  ) {
    super(`GC Stats ${path}: HTTP ${status}`);
  }
}

export function gcsApiConfigured(): boolean {
  return !!process.env.GCS_API_KEY;
}

export async function gcsApi<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const res = await gcsFetch(`/api/v2${path}`, { headers: { "x-api-key": process.env.GCS_API_KEY! }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new GcsApiError(res.status, path);
  return schema.parse(await res.json());
}

export const logosSchema = z
  .object({
    dark: z.object({ url_200x200: z.string().nullish() }).nullish(),
    light: z.object({ url_200x200: z.string().nullish() }).nullish(),
  })
  .nullish();

export function logoUrl(logos: z.infer<typeof logosSchema>): string | null {
  return gcsAssetUrl(logos?.dark?.url_200x200 ?? logos?.light?.url_200x200);
}

// GC Stats stores ISO 3166 alpha-3 codes, flags use alpha-2. Pairs are "CANCA" (alpha-3 then alpha-2).
const ALPHA2_BY_ALPHA3 = new Map(
  [
    "AFGAF ALBAL DZADZ ANDAD AGOAO ARGAR ARMAM AUSAU AUTAT AZEAZ BHSBS BHRBH BGDBD BRBBB BLRBY BELBE BLZBZ BENBJ BTNBT BOLBO BIHBA BWABW BRABR BRNBN BGRBG",
    "BFABF BDIBI KHMKH CMRCM CANCA CPVCV CAFCF TCDTD CHLCL CHNCN COLCO COMKM COGCG CODCD CRICR CIVCI HRVHR CUBCU CYPCY CZECZ DNKDK DJIDJ DMADM DOMDO ECUEC",
    "EGYEG SLVSV GNQGQ ERIER ESTEE SWZSZ ETHET EUREU FJIFJ FINFI FRAFR GABGA GMBGM GEOGE DEUDE GHAGH GRCGR GRDGD GTMGT GINGN GNBGW GUYGY HTIHT HNDHN HKGHK",
    "HUNHU ISLIS INDIN IDNID IRNIR IRQIQ IRLIE ISRIL ITAIT JAMJM JPNJP JORJO KAZKZ KENKE KIRKI KWTKW KGZKG LAOLA LVALV LBNLB LSOLS LBRLR LBYLY LIELI LTULT",
    "LUXLU MACMO MDGMG MWIMW MYSMY MDVMV MLIML MLTMT MHLMH MRTMR MUSMU MEXMX FSMFM MDAMD MCOMC MNGMN MNEME MARMA MOZMZ MMRMM NAMNA NRUNR NPLNP NLDNL NZLNZ",
    "NICNI NERNE NGANG PRKKP MKDMK NORNO OMNOM PAKPK PLWPW PSEPS PANPA PNGPG PRYPY PERPE PHLPH POLPL PRTPT QATQA ROURO RUSRU RWARW KNAKN LCALC VCTVC WSMWS",
    "SMRSM STPST SAUSA SENSN SRBRS SYCSC SLESL SGPSG SVKSK SVNSI SLBSB SOMSO ZAFZA KORKR SSDSS ESPES LKALK SDNSD SURSR SWESE CHECH SYRSY TWNTW TJKTJ TZATZ",
    "THATH TLSTL TGOTG TONTO TTOTT TUNTN TURTR TKMTM TUVTV UGAUG UKRUA AREAE GBRGB USAUS URYUY UZBUZ VUTVU VATVA VENVE VNMVN YEMYE ZMBZM ZWEZW",
  ]
    .join(" ")
    .split(" ")
    .map((pair) => [pair.slice(0, 3), pair.slice(3)] as const),
);

/** Alpha-2 code of a GC Stats country, null when unknown. */
export function gcsCountryCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  return upper.length === 2 ? upper : (ALPHA2_BY_ALPHA3.get(upper) ?? null);
}

/** GC Stats serves some assets as paths on its own domain. */
export function gcsAssetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("/") ? `${GCS_URL}${url}` : url;
}
