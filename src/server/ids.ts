import type Database from "better-sqlite3";

export function nextPrefixedId(
  db: Database.Database,
  table: "jobs" | "candidates" | "events" | "users",
  prefix: string
) {
  const rows = db.prepare(`SELECT id FROM ${table}`).all() as { id: string }[];
  const nums = rows
    .map((row) => Number(row.id.split("-")[1]))
    .filter((n) => Number.isFinite(n));
  return `${prefix}-${Math.max(1000, ...nums) + 1}`;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}
