import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import config from '../config.js';
import { calculateHoursSinceOilChange, calculateMonthsSinceOilChange } from './maintenance.js';

let transporter: Transporter | null = null;

export function getEmailTransporter(): Transporter | null {
  if (!config.email.host || !config.email.user || !config.email.password) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.user,
        pass: config.email.password,
      },
    });
  }

  return transporter;
}

function formatDuration(hours: number): string {
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  if (minutes === 0) {
    return `${wholeHours} hour${wholeHours !== 1 ? 's' : ''}`;
  }
  return `${wholeHours}h ${minutes}m`;
}

function createEmailTemplate(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 28px;
      font-weight: 600;
    }
    .content {
      padding: 40px 30px;
    }
    .alert-box {
      background-color: #f8f9fa;
      border-left: 4px solid #667eea;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .stats {
      display: table;
      width: 100%;
      margin: 30px 0;
    }
    .stat-item {
      display: table-row;
    }
    .stat-label {
      display: table-cell;
      padding: 12px 0;
      font-weight: 600;
      color: #495057;
      width: 50%;
    }
    .stat-value {
      display: table-cell;
      padding: 12px 0;
      color: #212529;
      text-align: right;
    }
    .stat-value.highlight {
      color: #667eea;
      font-weight: 600;
      font-size: 18px;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 30px;
      text-align: center;
      color: #6c757d;
      font-size: 14px;
    }
    .footer p {
      margin: 5px 0;
    }
    @media only screen and (max-width: 600px) {
      .header h1 {
        font-size: 24px;
      }
      .content {
        padding: 30px 20px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚡ GeneratorLog</h1>
    </div>
    <div class="content">
      ${body}
    </div>
    <div class="footer">
      <p><strong>GeneratorLog</strong> - Generator Usage Tracking</p>
      <p>This is an automated notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

interface GeneratorStopData {
  generatorName: string;
  durationHours: number;
  totalHours: number;
  lastOilChangeHours: number | null;
  oilChangeHours: number;
  lastOilChangeDate: Date | null;
  oilChangeMonths: number;
}

export function createStopConfirmationEmail(data: GeneratorStopData): { subject: string; html: string } {
  const hoursSinceOilChange = calculateHoursSinceOilChange(data.totalHours, data.lastOilChangeHours);
  const monthsSinceOilChange = calculateMonthsSinceOilChange(data.lastOilChangeDate);

  const hoursRemaining = Math.max(0, data.oilChangeHours - hoursSinceOilChange);
  const monthsRemaining = Math.max(0, data.oilChangeMonths - monthsSinceOilChange);

  const hoursPercentage = Math.min(100, (hoursSinceOilChange / data.oilChangeHours) * 100);
  const monthsPercentage = Math.min(100, (monthsSinceOilChange / data.oilChangeMonths) * 100);

  let statusMessage = '';
  if (hoursRemaining === 0 || monthsRemaining === 0) {
    statusMessage = '<div class="alert-box" style="border-left-color: #dc3545; background-color: #f8d7da;"><strong>⚠️ Oil Change Required!</strong><br>Your generator has reached the maintenance threshold.</div>';
  } else if (hoursPercentage >= 80 || monthsPercentage >= 80) {
    statusMessage = '<div class="alert-box" style="border-left-color: #ffc107; background-color: #fff3cd;"><strong>⚠️ Oil Change Coming Soon</strong><br>Your generator is approaching the maintenance threshold.</div>';
  } else {
    statusMessage = '<div class="alert-box"><strong>✅ Running Smoothly</strong><br>Your generator is in good operating condition.</div>';
  }

  const body = `
    <h2>Generator Stopped</h2>
    <p>Your generator <strong>${data.generatorName}</strong> has been stopped.</p>

    ${statusMessage}

    <div class="stats">
      <div class="stat-item">
        <div class="stat-label">Runtime This Session:</div>
        <div class="stat-value highlight">${formatDuration(data.durationHours)}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Total Runtime:</div>
        <div class="stat-value">${data.totalHours.toFixed(2)} hours</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Hours in Current Cycle:</div>
        <div class="stat-value">${hoursSinceOilChange.toFixed(2)} hours</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Hours Until Next Oil Change:</div>
        <div class="stat-value ${hoursRemaining === 0 ? 'highlight' : ''}">${hoursRemaining.toFixed(2)} hours</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Months in Current Cycle:</div>
        <div class="stat-value">${monthsSinceOilChange} month${monthsSinceOilChange !== 1 ? 's' : ''}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Months Until Next Oil Change:</div>
        <div class="stat-value ${monthsRemaining === 0 ? 'highlight' : ''}">${monthsRemaining} month${monthsRemaining !== 1 ? 's' : ''}</div>
      </div>
    </div>
  `;

  return {
    subject: `Generator Stopped - ${data.generatorName}`,
    html: createEmailTemplate('Generator Stopped', body),
  };
}

interface MaintenanceReminderData {
  generatorName: string;
  totalHours: number;
  lastOilChangeHours: number | null;
  oilChangeHours: number;
  lastOilChangeDate: Date | null;
  oilChangeMonths: number;
}

export function createMaintenanceReminderEmail(data: MaintenanceReminderData): { subject: string; html: string } {
  const hoursSinceOilChange = calculateHoursSinceOilChange(data.totalHours, data.lastOilChangeHours);
  const monthsSinceOilChange = calculateMonthsSinceOilChange(data.lastOilChangeDate);

  const hoursOverdue = Math.max(0, hoursSinceOilChange - data.oilChangeHours);
  const monthsOverdue = Math.max(0, monthsSinceOilChange - data.oilChangeMonths);

  let reasonText = '';
  if (hoursOverdue > 0 && monthsOverdue > 0) {
    reasonText = `Your generator has exceeded both the runtime threshold by <strong>${hoursOverdue.toFixed(2)} hours</strong> and the time threshold by <strong>${monthsOverdue} month${monthsOverdue !== 1 ? 's' : ''}</strong>.`;
  } else if (hoursOverdue > 0) {
    reasonText = `Your generator has exceeded the runtime threshold by <strong>${hoursOverdue.toFixed(2)} hours</strong>.`;
  } else {
    reasonText = `Your generator has exceeded the time threshold by <strong>${monthsOverdue} month${monthsOverdue !== 1 ? 's' : ''}</strong>.`;
  }

  const body = `
    <h2>🔧 Oil Change Required</h2>
    <p>It's time to perform maintenance on your generator <strong>${data.generatorName}</strong>.</p>

    <div class="alert-box" style="border-left-color: #dc3545; background-color: #f8d7da;">
      <strong>⚠️ Maintenance Threshold Reached</strong><br>
      ${reasonText}
    </div>

    <div class="stats">
      <div class="stat-item">
        <div class="stat-label">Total Runtime:</div>
        <div class="stat-value">${data.totalHours.toFixed(2)} hours</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Hours Since Last Oil Change:</div>
        <div class="stat-value highlight">${hoursSinceOilChange.toFixed(2)} hours</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Oil Change Threshold:</div>
        <div class="stat-value">${data.oilChangeHours} hours</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Months Since Last Oil Change:</div>
        <div class="stat-value highlight">${monthsSinceOilChange} month${monthsSinceOilChange !== 1 ? 's' : ''}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Time-Based Threshold:</div>
        <div class="stat-value">${data.oilChangeMonths} month${data.oilChangeMonths !== 1 ? 's' : ''}</div>
      </div>
    </div>

    <p style="margin-top: 30px; color: #495057;">
      Regular maintenance ensures optimal performance and longevity of your generator.
      Please schedule an oil change at your earliest convenience.
    </p>
  `;

  return {
    subject: `🔧 Oil Change Required - ${data.generatorName}`,
    html: createEmailTemplate('Oil Change Required', body),
  };
}

export async function sendStopConfirmationEmail(
  userEmail: string,
  data: GeneratorStopData
): Promise<void> {
  const emailTransporter = getEmailTransporter();
  if (!emailTransporter) {
    throw new Error('Email service not configured');
  }

  const { subject, html } = createStopConfirmationEmail(data);

  await emailTransporter.sendMail({
    from: config.email.from,
    to: userEmail,
    subject,
    html,
  });
}

export async function sendMaintenanceReminderEmail(
  userEmail: string,
  data: MaintenanceReminderData
): Promise<void> {
  const emailTransporter = getEmailTransporter();
  if (!emailTransporter) {
    throw new Error('Email service not configured');
  }

  const { subject, html } = createMaintenanceReminderEmail(data);

  await emailTransporter.sendMail({
    from: config.email.from,
    to: userEmail,
    subject,
    html,
  });
}

export async function sendTestEmail(userEmail: string, userName: string): Promise<void> {
  const emailTransporter = getEmailTransporter();
  if (!emailTransporter) {
    throw new Error('Email service not configured');
  }

  const body = `
    <h2>✅ Email Configuration Test</h2>
    <p>Hello <strong>${userName}</strong>,</p>
    <p>Congratulations! Your GeneratorLog email configuration is working correctly.</p>

    <div class="alert-box">
      <strong>✅ SMTP Connection Successful</strong><br>
      Your generator maintenance alerts will be delivered to this email address.
    </div>

    <div class="stats">
      <div class="stat-item">
        <div class="stat-label">SMTP Server:</div>
        <div class="stat-value">${config.email.host}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Recipient:</div>
        <div class="stat-value">${userEmail}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Test Date:</div>
        <div class="stat-value">${new Date().toLocaleString()}</div>
      </div>
    </div>

    <p style="margin-top: 30px; color: #495057;">
      You will receive automated emails when:
    </p>
    <ul style="color: #495057;">
      <li>Your generator is stopped (with runtime statistics)</li>
      <li>Maintenance is due based on running hours or time elapsed</li>
    </ul>
  `;

  await emailTransporter.sendMail({
    from: config.email.from,
    to: userEmail,
    subject: '✅ GeneratorLog Email Test - Configuration Successful',
    html: createEmailTemplate('Email Test Successful', body),
  });
}
