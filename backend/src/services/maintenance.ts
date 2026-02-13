export function calculateHoursSinceOilChange(
  totalHours: number,
  lastOilChangeHours: number | null | undefined
): number {
  if (lastOilChangeHours === null || lastOilChangeHours === undefined) {
    return totalHours;
  }
  return totalHours - lastOilChangeHours;
}

export function calculateMonthsSinceOilChange(
  lastOilChangeDate: Date | null,
  now: Date = new Date()
): number {
  if (!lastOilChangeDate) {
    // Return a very large number to indicate never changed
    return 999;
  }

  const yearDiff = now.getFullYear() - lastOilChangeDate.getFullYear();
  const monthDiff = now.getMonth() - lastOilChangeDate.getMonth();
  
  return yearDiff * 12 + monthDiff;
}

export function shouldSendMaintenanceReminder(
  totalHours: number,
  lastOilChangeHours: number | null | undefined,
  hoursThreshold: number,
  lastOilChangeDate: Date | null,
  monthsThreshold: number,
  now: Date = new Date()
): boolean {
  const hoursSinceChange = calculateHoursSinceOilChange(totalHours, lastOilChangeHours);
  const monthsSinceChange = calculateMonthsSinceOilChange(lastOilChangeDate, now);

  return hoursSinceChange >= hoursThreshold || monthsSinceChange >= monthsThreshold;
}
