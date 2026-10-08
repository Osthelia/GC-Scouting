/**
 * GC-Scouting - language-flags
 *
 * Flags of the languages of a post.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { GlobeIcon } from "lucide-react";
import { useLocale } from "next-intl";
import { languageFlag } from "@/lib/languages";

/** Flag standing for a language, globe when the language has no flag. */
export function LanguageFlag({ code, name }: { code: string; name?: string }) {
  const flag = languageFlag(code);
  return flag ? (
    <span title={name} aria-label={name} className={`fi fi-${flag} flex-none rounded-[2px]`} style={{ width: 18, height: 13.5, lineHeight: "13.5px" }} />
  ) : (
    <GlobeIcon aria-label={name} className="h-3.5 w-3.5 flex-none text-neutral-500" />
  );
}

/** One flag per spoken language. */
export function LanguageFlags({ languages }: { languages: readonly string[] }) {
  const locale = useLocale();
  const names = new Intl.DisplayNames([locale], { type: "language" });

  return (
    <span className="flex items-center gap-1">
      {languages.map((code) => (
        <LanguageFlag key={code} code={code} name={names.of(code) ?? code} />
      ))}
    </span>
  );
}
