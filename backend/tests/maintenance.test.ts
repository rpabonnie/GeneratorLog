import { describe, expect, it } from 'vitest';
import { calculateHoursSinceOilChange, calculateMonthsSinceOilChange, shouldSendMaintenanceReminder } from '../src/services/maintenance.js';

describe('Maintenance calculations', () => {
  describe('calculateHoursSinceOilChange', () => {
    it('calculates hours since last oil change', () => {
      const totalHours = 100;
      const lastOilChangeHours = 50;
      
      const hoursSinceChange = calculateHoursSinceOilChange(totalHours, lastOilChangeHours);
      expect(hoursSinceChange).toBe(50);
    });

    it('returns 0 when total hours equals last oil change hours', () => {
      const hoursSinceChange = calculateHoursSinceOilChange(100, 100);
      expect(hoursSinceChange).toBe(0);
    });

    it('handles null last oil change hours', () => {
      const hoursSinceChange = calculateHoursSinceOilChange(100, null);
      expect(hoursSinceChange).toBe(100);
    });

    it('handles undefined last oil change hours', () => {
      const hoursSinceChange = calculateHoursSinceOilChange(100, undefined);
      expect(hoursSinceChange).toBe(100);
    });
  });

  describe('calculateMonthsSinceOilChange', () => {
    it('calculates months since last oil change', () => {
      const now = new Date(Date.UTC(2026, 5, 1)); // Jun 1, 2026
      const lastOilChangeDate = new Date(Date.UTC(2026, 0, 1)); // Jan 1, 2026

      const monthsSinceChange = calculateMonthsSinceOilChange(lastOilChangeDate, now);
      expect(monthsSinceChange).toBe(5);
    });

    it('returns 0 when less than a month has passed', () => {
      // Use explicit UTC dates to avoid timezone issues
      const now = new Date(Date.UTC(2026, 0, 15)); // Jan 15, 2026
      const lastOilChangeDate = new Date(Date.UTC(2026, 0, 1)); // Jan 1, 2026

      const monthsSinceChange = calculateMonthsSinceOilChange(lastOilChangeDate, now);
      expect(monthsSinceChange).toBe(0);
    });

    it('handles null last oil change date', () => {
      const now = new Date(Date.UTC(2026, 5, 1)); // Jun 1, 2026

      const monthsSinceChange = calculateMonthsSinceOilChange(null, now);
      expect(monthsSinceChange).toBeGreaterThan(100); // Should be very large
    });

    it('uses installedAt as fallback when lastOilChangeDate is null', () => {
      const now = new Date(Date.UTC(2026, 5, 1)); // Jun 1, 2026
      const installedAt = new Date(Date.UTC(2026, 0, 1)); // Jan 1, 2026

      const monthsSinceChange = calculateMonthsSinceOilChange(null, now, installedAt);
      expect(monthsSinceChange).toBe(5);
    });

    it('prefers lastOilChangeDate over installedAt when both are provided', () => {
      const now = new Date(Date.UTC(2026, 5, 1)); // Jun 1, 2026
      const lastOilChangeDate = new Date(Date.UTC(2026, 3, 1)); // Apr 1, 2026 - 2 months ago
      const installedAt = new Date(Date.UTC(2026, 0, 1)); // Jan 1, 2026 - 5 months ago

      const monthsSinceChange = calculateMonthsSinceOilChange(lastOilChangeDate, now, installedAt);
      expect(monthsSinceChange).toBe(2); // Uses lastOilChangeDate, not installedAt
    });

    it('handles dates across year boundaries', () => {
      const now = new Date(Date.UTC(2026, 1, 1)); // Feb 1, 2026
      const lastOilChangeDate = new Date(Date.UTC(2025, 10, 1)); // Nov 1, 2025

      const monthsSinceChange = calculateMonthsSinceOilChange(lastOilChangeDate, now);
      expect(monthsSinceChange).toBe(3);
    });
  });

  describe('shouldSendMaintenanceReminder', () => {
    it('returns true when hours threshold is exceeded', () => {
      const totalHours = 100;
      const lastOilChangeHours = 50;
      const hoursThreshold = 40;
      const lastOilChangeDate = new Date('2026-01-01');
      const monthsThreshold = 6;
      
      const shouldRemind = shouldSendMaintenanceReminder(
        totalHours,
        lastOilChangeHours,
        hoursThreshold,
        lastOilChangeDate,
        monthsThreshold
      );
      
      expect(shouldRemind).toBe(true);
    });

    it('returns true when months threshold is exceeded', () => {
      const totalHours = 100;
      const lastOilChangeHours = 90; // Only 10 hours since change
      const hoursThreshold = 50;
      const lastOilChangeDate = new Date(Date.UTC(2025, 5, 1)); // Jun 1, 2025 - 8 months ago
      const monthsThreshold = 6;
      const now = new Date(Date.UTC(2026, 1, 1)); // Feb 1, 2026

      const shouldRemind = shouldSendMaintenanceReminder(
        totalHours,
        lastOilChangeHours,
        hoursThreshold,
        lastOilChangeDate,
        monthsThreshold,
        now
      );

      expect(shouldRemind).toBe(true);
    });

    it('returns false when neither threshold is exceeded', () => {
      const totalHours = 100;
      const lastOilChangeHours = 90; // Only 10 hours
      const hoursThreshold = 50;
      const lastOilChangeDate = new Date(Date.UTC(2026, 0, 1)); // Jan 1, 2026 - 1 month ago
      const monthsThreshold = 6;
      const now = new Date(Date.UTC(2026, 1, 1)); // Feb 1, 2026

      const shouldRemind = shouldSendMaintenanceReminder(
        totalHours,
        lastOilChangeHours,
        hoursThreshold,
        lastOilChangeDate,
        monthsThreshold,
        now
      );

      expect(shouldRemind).toBe(false);
    });

    it('returns true when exactly at hours threshold', () => {
      const totalHours = 100;
      const lastOilChangeHours = 50;
      const hoursThreshold = 50;
      const lastOilChangeDate = new Date('2026-01-01');
      const monthsThreshold = 6;
      
      const shouldRemind = shouldSendMaintenanceReminder(
        totalHours,
        lastOilChangeHours,
        hoursThreshold,
        lastOilChangeDate,
        monthsThreshold
      );
      
      expect(shouldRemind).toBe(true);
    });

    it('returns true when exactly at months threshold', () => {
      const totalHours = 100;
      const lastOilChangeHours = 90;
      const hoursThreshold = 50;
      const lastOilChangeDate = new Date(Date.UTC(2025, 7, 1)); // Aug 1, 2025 - 6 months ago
      const monthsThreshold = 6;
      const now = new Date(Date.UTC(2026, 1, 1)); // Feb 1, 2026

      const shouldRemind = shouldSendMaintenanceReminder(
        totalHours,
        lastOilChangeHours,
        hoursThreshold,
        lastOilChangeDate,
        monthsThreshold,
        now
      );

      expect(shouldRemind).toBe(true);
    });

    it('uses installedAt when no oil change has been recorded and threshold exceeded', () => {
      // Generator installed 8 months ago, never had oil change, low hours
      const now = new Date(Date.UTC(2026, 1, 1)); // Feb 1, 2026
      const installedAt = new Date(Date.UTC(2025, 5, 1)); // Jun 1, 2025 — 8 months ago

      const shouldRemind = shouldSendMaintenanceReminder(
        5, null, 50, null, 6, now, installedAt
      );

      expect(shouldRemind).toBe(true); // 8 months > 6 month threshold
    });
  });
});
