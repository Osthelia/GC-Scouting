/**
 * GC-Scouting - tweets loading
 *
 * Loading skeleton of the tweet queue.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { Loader2Icon } from "lucide-react";

export default function TweetsLoading() {
  return (
    <div className="flex justify-center py-24 text-neutral-500">
      <Loader2Icon className="h-6 w-6 animate-spin" />
    </div>
  );
}
