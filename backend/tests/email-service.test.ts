import { describe, expect, it, vi } from 'vitest';
import {
  createStopConfirmationEmail,
  createMaintenanceReminderEmail,
  getEmailTransporter,
} from '../src/services/email.js';

describe('Email Service', () => {
  describe('getEmailTransporter', () => {
    it('returns null when email configuration is missing', () => {
      const transporter = getEmailTransporter();
      expect(transporter).toBeNull();
    });
  });

  describe('createStopConfirmationEmail', () => {
    it('creates a stop confirmation email with all required information', () => {
      const data = {
        generatorName: 'Test Generator',
        durationHours: 2.5,
        totalHours: 50,
        lastOilChangeHours: 10,
        oilChangeHours: 100,
        lastOilChangeDate: new Date('2025-08-01'),
        oilChangeMonths: 6,
      };

      const { subject, html } = createStopConfirmationEmail(data);

      expect(subject).toBe('Generator Stopped - Test Generator');
      expect(html).toContain('Test Generator');
      expect(html).toContain('2h 30m');
      expect(html).toContain('50.00 hours');
      expect(html).toContain('GeneratorLog');
    });

    it('shows maintenance warning when hours threshold is reached', () => {
      const data = {
        generatorName: 'Test Generator',
        durationHours: 10,
        totalHours: 110,
        lastOilChangeHours: 10,
        oilChangeHours: 100,
        lastOilChangeDate: new Date('2025-08-01'),
        oilChangeMonths: 6,
      };

      const { html } = createStopConfirmationEmail(data);

      expect(html).toContain('Oil Change Required');
      expect(html).toContain('0.00 hours');
    });

    it('shows maintenance warning when months threshold is reached', () => {
      const now = new Date('2026-03-01');
      const data = {
        generatorName: 'Test Generator',
        durationHours: 2,
        totalHours: 50,
        lastOilChangeHours: 10,
        oilChangeHours: 100,
        lastOilChangeDate: new Date('2025-08-01'),
        oilChangeMonths: 6,
      };

      vi.useFakeTimers();
      vi.setSystemTime(now);

      const { html } = createStopConfirmationEmail(data);

      expect(html).toContain('Oil Change');
      expect(html).toContain('0 month');

      vi.useRealTimers();
    });

    it('formats duration correctly for minutes', () => {
      const data = {
        generatorName: 'Test Generator',
        durationHours: 0.25,
        totalHours: 50,
        lastOilChangeHours: 10,
        oilChangeHours: 100,
        lastOilChangeDate: new Date('2025-08-01'),
        oilChangeMonths: 6,
      };

      const { html } = createStopConfirmationEmail(data);

      expect(html).toContain('15 minutes');
    });
  });

  describe('createMaintenanceReminderEmail', () => {
    it('creates a maintenance reminder email with all required information', () => {
      const data = {
        generatorName: 'Test Generator',
        totalHours: 120,
        lastOilChangeHours: 10,
        oilChangeHours: 100,
        lastOilChangeDate: new Date('2025-01-01'),
        oilChangeMonths: 6,
      };

      const { subject, html } = createMaintenanceReminderEmail(data);

      expect(subject).toBe('🔧 Oil Change Required - Test Generator');
      expect(html).toContain('Oil Change Required');
      expect(html).toContain('Test Generator');
      expect(html).toContain('120.00 hours');
      expect(html).toContain('110.00 hours');
      expect(html).toContain('100 hours');
    });

    it('shows hours overdue when hours threshold is exceeded', () => {
      const data = {
        generatorName: 'Test Generator',
        totalHours: 130,
        lastOilChangeHours: 20,
        oilChangeHours: 100,
        lastOilChangeDate: new Date('2025-08-01'),
        oilChangeMonths: 6,
      };

      const { html } = createMaintenanceReminderEmail(data);

      expect(html).toContain('10.00 hours');
      expect(html).toContain('exceeded the runtime threshold');
    });

    it('shows months overdue when time threshold is exceeded', () => {
      const now = new Date('2026-08-01');
      const data = {
        generatorName: 'Test Generator',
        totalHours: 50,
        lastOilChangeHours: 10,
        oilChangeHours: 100,
        lastOilChangeDate: new Date('2025-01-01'),
        oilChangeMonths: 6,
      };

      vi.useFakeTimers();
      vi.setSystemTime(now);

      const { html } = createMaintenanceReminderEmail(data);

      expect(html).toContain('exceeded');
      expect(html).toContain('19 month');

      vi.useRealTimers();
    });

    it('mentions both thresholds when both are exceeded', () => {
      const now = new Date('2026-08-01');
      const data = {
        generatorName: 'Test Generator',
        totalHours: 130,
        lastOilChangeHours: 20,
        oilChangeHours: 100,
        lastOilChangeDate: new Date('2025-01-01'),
        oilChangeMonths: 6,
      };

      vi.useFakeTimers();
      vi.setSystemTime(now);

      const { html } = createMaintenanceReminderEmail(data);

      expect(html).toContain('exceeded both');
      expect(html).toContain('10.00 hours');
      expect(html).toContain('month');

      vi.useRealTimers();
    });
  });
});
