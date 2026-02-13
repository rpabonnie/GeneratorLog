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
      const now = new Date('2026-06-01');
      const lastOilChangeDate = new Date('2026-01-01');
      
      const monthsSinceChange = calculateMonthsSinceOilChange(lastOilChangeDate, now);
      expect(monthsSinceChange).toBe(5);
    });

    it('returns 0 when less than a month has passed', () => {
      const now = new Date('2026-01-15');
      const lastOilChangeDate = new Date('2026-01-01');
      
      const monthsSinceChange = calculateMonthsSinceOilChange(lastOilChangeDate, now);
      expect(monthsSinceChange).toBe(0);
    });

    it('handles null last oil change date', () => {
      const now = new Date('2026-06-01');
      
      const monthsSinceChange = calculateMonthsSinceOilChange(null, now);
      expect(monthsSinceChange).toBeGreaterThan(100); // Should be very large
    });

    it('handles dates across year boundaries', () => {
      const now = new Date('2026-02-01');
      const lastOilChangeDate = new Date('2025-11-01');
      
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
      const lastOilChangeDate = new Date('2025-06-01'); // 8 months ago
      const monthsThreshold = 6;
      const now = new Date('2026-02-01');
      
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
      const lastOilChangeDate = new Date('2026-01-01'); // 1 month ago
      const monthsThreshold = 6;
      const now = new Date('2026-02-01');
      
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
      const lastOilChangeDate = new Date('2025-08-01'); // 6 months ago
      const monthsThreshold = 6;
      const now = new Date('2026-02-01');
      
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
  });
});
