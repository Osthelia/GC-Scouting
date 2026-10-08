/**
 * GC-Scouting - post-tweet-panel
 *
 * Panel that helps the author tweet a post and save the link.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangleIcon, CheckIcon, ExternalLinkIcon, Loader2Icon, MegaphoneIcon, Repeat2Icon, SendIcon } from "lucide-react";
import type { TweetBy } from "@scouting/db/constants";
import { tweetIntentUrl, tweetStatusUrl } from "@scouting/db/twitter";
import { useRouter } from "@/i18n/navigation";
import { saveAuthorTweet, setPostTweetBy, type PostTweetError, type PostTweetResult } from "@/actions/post-tweet";
import type { TweetDraft } from "@/lib/notify/bot";
import { Field, TextInput } from "@/components/ui/field";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { TweetImageButton } from "@/components/tweets/tweet-image-button";
import { LanguageFlag } from "@/components/post/language-flags";
import { useLanguageName } from "@/components/posts/posts-filters";
import { cn } from "@/lib/utils";

const TWEET_MAX = 280;

const button = "inline-flex h-9 items-center gap-1.5 rounded-[9px] border px-3 text-[13px] font-semibold transition-all active:scale-[0.97] disabled:opacity-70";
const secondary = "border-neutral-800 bg-[var(--sc-surface)] text-neutral-200 hover:bg-[var(--sc-hover)]";
const accentSoft = "border-[color-mix(in_oklab,var(--sc-accent)_45%,transparent)] bg-[color-mix(in_oklab,var(--sc-accent)_14%,transparent)] text-[var(--sc-accent)]";

/** Author only: who tweets the post, and the author's own tweet with the link to give back. */
export function PostTweetPanel({
  postId,
  tweetBy,
  authorTweetId,
  tweeted,
  drafts,
}: {
  postId: number;
  tweetBy: TweetBy;
  authorTweetId: string | null;
  tweeted: boolean;
  /** Text to tweet per language the author may pick, the default first. Null when it could not be written. Only used when the author tweets. */
  drafts: TweetDraft[] | null;
}) {
  const t = useTranslations("postTweet");
  const router = useRouter();
  const [switching, startSwitch] = useTransition();
  const [saving, startSave] = useTransition();
  const [opened, setOpened] = useState(false);
  const [url, setUrl] = useState(authorTweetId ? tweetStatusUrl(authorTweetId) : "");
  const [error, setError] = useState<PostTweetError | null>(null);
  const [saved, setSaved] = useState(false);
  const [language, setLanguage] = useState(drafts?.[0]?.locale);
  const languageName = useLanguageName();
  const draft = drafts?.find((d) => d.locale === language) ?? drafts?.[0];

  function run(action: () => Promise<PostTweetResult>, start: typeof startSwitch, onDone?: () => void) {
    setError(null);
    start(async () => {
      const result = await action().catch((): PostTweetResult => ({ ok: false, error: "server" }));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone?.();
      router.refresh();
    });
  }

  const switchTo = (next: TweetBy) => run(() => setPostTweetBy(postId, next), startSwitch);

  if (tweeted) {
    return (
      <Notice icon={tweetBy === "author" ? Repeat2Icon : MegaphoneIcon} title={t(tweetBy === "author" ? "retweeted" : "tweeted")}>
        {authorTweetId && tweetBy === "author" && <TweetLink id={authorTweetId} label={t("viewTweet")} />}
      </Notice>
    );
  }

  if (tweetBy === "site") {
    return (
      <Notice icon={MegaphoneIcon} title={t("siteTitle")} text={t("siteText")}>
        <button type="button" onClick={() => switchTo("author")} disabled={switching} aria-busy={switching} className={cn(button, secondary)}>
          {switching ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : <Repeat2Icon className="h-3.5 w-3.5" />}
          {t(switching ? "switching" : "switchToAuthor")}
        </button>
        {error && <ErrorText>{t(`errors.${error}`)}</ErrorText>}
      </Notice>
    );
  }

  const linkSaved = authorTweetId !== null;
  const fieldError = error === "required" || error === "tweetUrlInvalid";

  return (
    <section className="mt-4 rounded-xl border border-[color-mix(in_oklab,var(--sc-accent)_35%,transparent)] bg-[color-mix(in_oklab,var(--sc-accent)_6%,transparent)] px-4 py-4">
      <div className="flex items-start gap-3">
        <Repeat2Icon className="mt-0.5 h-4 w-4 flex-none text-[var(--sc-accent)]" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-neutral-100">{t(linkSaved ? "authorSavedTitle" : "authorTitle")}</p>
          <p className="mt-0.5 text-[13px] text-neutral-400">{t(linkSaved ? "authorSavedText" : "authorText")}</p>

          {draft ? (
            <>
              {drafts!.length > 1 && (
                <div className="mt-3">
                  <p className="text-[12.5px] font-medium text-neutral-400">{t("language")}</p>
                  <div role="group" aria-label={t("language")} className="mt-1.5 flex flex-wrap gap-1.5">
                    {drafts!.map((d) => (
                      <ToggleChip
                        key={d.locale}
                        active={d.locale === draft.locale}
                        onClick={() => {
                          setLanguage(d.locale);
                          setOpened(false);
                        }}
                      >
                        <LanguageFlag code={d.locale} />
                        {languageName(d.locale)}
                      </ToggleChip>
                    ))}
                  </div>
                </div>
              )}
              <pre className="mt-3 rounded-lg border border-neutral-800 bg-[var(--sc-surface-2)] p-3 font-sans text-[13.5px] whitespace-pre-wrap text-neutral-200">{draft.text}</pre>
              <p className={cn("mt-1.5 inline-flex items-center gap-1.5 text-[12px]", draft.tooLong ? "text-amber-400" : "text-neutral-500")}>
                {draft.tooLong && <AlertTriangleIcon className="h-3.5 w-3.5" />}
                {t("length", { length: draft.length, max: TWEET_MAX })}
                {draft.tooLong && <span>{t("tooLong")}</span>}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <TweetImageButton postId={postId} text={draft.text} onShared={() => setOpened(true)} className={cn(button, secondary)} />
                <a
                  href={tweetIntentUrl(draft.text)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpened(true)}
                  className={cn(button, opened ? accentSoft : "border-transparent bg-[var(--sc-accent)] text-[var(--sc-accent-ink)] hover:brightness-110")}
                >
                  {opened ? <CheckIcon className="h-3.5 w-3.5" /> : <ExternalLinkIcon className="h-3.5 w-3.5" />}
                  {t(opened ? "opened" : "open")}
                </a>
              </div>
            </>
          ) : (
            <p role="alert" className="mt-3 text-[13px] text-amber-400">
              {t("draftUnavailable")}
            </p>
          )}

          <form
            noValidate
            className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start"
            onSubmit={(e) => {
              e.preventDefault();
              setSaved(false);
              run(() => saveAuthorTweet(postId, url), startSave, () => setSaved(true));
            }}
          >
            <Field label={t("linkLabel")} htmlFor={`tweet-url-${postId}`} required error={fieldError ? t(`errors.${error}`) : undefined} className="min-w-0 flex-1">
              <TextInput
                id={`tweet-url-${postId}`}
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setSaved(false);
                  if (fieldError) setError(null);
                }}
                placeholder={t("linkPlaceholder")}
                invalid={fieldError}
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
            <button
              type="submit"
              disabled={saving}
              aria-busy={saving}
              className={cn(button, "sm:mt-[26px]", saved ? accentSoft : "border-transparent bg-[var(--sc-accent)] text-[var(--sc-accent-ink)] hover:brightness-110")}
            >
              {saving ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : saved ? <CheckIcon className="h-3.5 w-3.5" /> : <SendIcon className="h-3.5 w-3.5" />}
              {t(saving ? "saving" : saved ? "saved" : "save")}
            </button>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {linkSaved && <TweetLink id={authorTweetId} label={t("viewTweet")} />}
            <button type="button" onClick={() => switchTo("site")} disabled={switching} aria-busy={switching} className={cn(button, secondary)}>
              {switching ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : <MegaphoneIcon className="h-3.5 w-3.5" />}
              {t(switching ? "switching" : "switchToSite")}
            </button>
          </div>
          {error && !fieldError && <ErrorText>{t(`errors.${error}`)}</ErrorText>}
        </div>
      </div>
    </section>
  );
}

function Notice({ icon: Icon, title, text, children }: { icon: typeof MegaphoneIcon; title: string; text?: string; children?: React.ReactNode }) {
  return (
    <section className="mt-4 flex flex-col gap-3 rounded-xl border border-neutral-800 bg-[var(--sc-surface-2)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 flex-none text-[var(--sc-accent)]" />
        <div>
          <p className="text-[14px] font-semibold text-neutral-100">{title}</p>
          {text && <p className="mt-0.5 text-[13px] text-neutral-400">{text}</p>}
        </div>
      </div>
      {children && <div className="flex flex-col items-start gap-1.5 sm:items-end">{children}</div>}
    </section>
  );
}

function TweetLink({ id, label }: { id: string; label: string }) {
  return (
    <a href={tweetStatusUrl(id)} target="_blank" rel="noopener noreferrer" className={cn(button, secondary)}>
      <ExternalLinkIcon className="h-3.5 w-3.5" />
      {label}
    </a>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-2 text-[12.5px] text-red-400">
      {children}
    </p>
  );
}
