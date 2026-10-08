-- 5 tiers to 3: "if needed" (2) and "can learn" (3) become "can learn" (2), "can't play" (4) is dropped.
UPDATE "posts" SET "tier_list" = (
	SELECT jsonb_object_agg(e.key, CASE WHEN e.value::int >= 2 THEN 2 ELSE e.value::int END)
	FROM jsonb_each_text("posts"."tier_list") AS e
	WHERE e.value::int < 4
)
WHERE "tier_list" IS NOT NULL;
