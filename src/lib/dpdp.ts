export const DPDP_RETENTION_DAYS = 180;

export function addDays(from: Date, days: number) {
  const next = new Date(from.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function retentionExpiryFromCreatedAt(createdAt?: string | null) {
  const created = createdAt ? new Date(createdAt) : new Date();
  const valid = Number.isNaN(created.getTime()) ? new Date() : created;
  return addDays(valid, DPDP_RETENTION_DAYS).toISOString();
}

export function daysUntilRetentionExpiry(expiry?: string | null, createdAt?: string | null) {
  const iso = expiry || retentionExpiryFromCreatedAt(createdAt);
  const end = new Date(iso);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  return Math.round((endDay.getTime() - start.getTime()) / 86_400_000);
}
