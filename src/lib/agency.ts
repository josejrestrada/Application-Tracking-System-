export function calcAgencyFeeAmount(expectedCtc: number, feePct: number) {
  if (!Number.isFinite(expectedCtc) || !Number.isFinite(feePct)) return 0;
  return Number((expectedCtc * (feePct / 100)).toFixed(4));
}

export function formatFeeLpa(amount?: number | null) {
  if (amount == null || Number.isNaN(amount)) return '—';
  return `${amount.toFixed(2)} LPA`;
}
