export function calculateHoursSinceOilChange(
  totalHours: number,
  lastOilChangeHours: number | null | undefined
): number {
  if (lastOilChangeHours === null || lastOilChangeHours === undefined) {
    return totalHours;
  }
  return totalHours - lastOilChangeHours;
}

// When lastOilChangeDate is null, falls back to installedAt as the reference date.
// If both are null, returns 999 to signal "never changed, unknown install date".
export function calculateMonthsSinceOilChange(
  lastOilChangeDate: Date | null,
  now: Date = new Date(),
  installedAt: Date | null = null
): number {
  const referenceDate = lastOilChangeDate ?? installedAt;
  if (!referenceDate) {
    // Return a very large number to indicate never changed
    return 999;
  }

  const yearDiff = now.getUTCFullYear() - referenceDate.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - referenceDate.getUTCMonth();

  return yearDiff * 12 + monthDiff;
}

export function shouldSendMaintenanceReminder(
  totalHours: number,
  lastOilChangeHours: number | null | undefined,
  hoursThreshold: number,
  lastOilChangeDate: Date | null,
  monthsThreshold: number,
  now: Date = new Date(),
  installedAt: Date | null = null
): boolean {
  const hoursSinceChange = calculateHoursSinceOilChange(totalHours, lastOilChangeHours);
  const monthsSinceChange = calculateMonthsSinceOilChange(lastOilChangeDate, now, installedAt);

  return hoursSinceChange >= hoursThreshold || monthsSinceChange >= monthsThreshold;
}
