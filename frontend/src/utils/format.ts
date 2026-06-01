export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return '—';
  const totalMinutes = Math.round(hours * 60);
  if (totalMinutes < 60) return `${totalMinutes}min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h}hr` : `${h}hr ${m}min`;
}
