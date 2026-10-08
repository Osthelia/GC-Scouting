/**
 * GC-Scouting - og-icons
 *
 * Generates PNG copies of the agent and rank icons for the share images.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

// PNG copies of the agent and rank icons for the share images (next/og does not read webp).
// Run again after adding an agent or a rank icon: npm run og:icons -w apps/web
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const ROOT = new URL("../public/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SIZE = 96;

for (const folder of ["agents", "ranks"]) {
  const from = join(ROOT, "valorant", folder);
  const to = join(ROOT, "og", folder);
  await mkdir(to, { recursive: true });
  const files = (await readdir(from)).filter((file) => file.endsWith(".webp"));
  await Promise.all(
    files.map((file) =>
      sharp(join(from, file))
        .resize(SIZE, SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ compressionLevel: 9 })
        .toFile(join(to, file.replace(/\.webp$/, ".png"))),
    ),
  );
  console.log(`${folder}: ${files.length} icons`);
}
