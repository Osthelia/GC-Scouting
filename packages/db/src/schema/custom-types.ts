/**
 * GC-Scouting - custom-types
 *
 * Custom Postgres column types.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Scouting
 * @license   https://github.com/Osthelia/GC-Scouting/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Scouting
 */

import { customType } from "drizzle-orm/pg-core";

// Drizzle has no range builder: values round-trip as the Postgres literal, e.g. "{[1200,1410),[2640,2850)}".
export const int4multirange = customType<{ data: string }>({
  dataType() {
    return "int4multirange";
  },
});
