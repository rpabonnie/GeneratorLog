/*
  Run this in the deployed environment (inside the container or VM)
  to verify SMTP connectivity and auth using the environment variables
  configured there. This prints only non-sensitive connection info.

  Usage (inside container):
    node /workspace/scripts/smtp-test.js
*/

import nodemailer from 'nodemailer';

const host = process.env.SMTP_HOST;
const port = parseInt(process.env.SMTP_PORT || '0', 10) || undefined;
const secure = (process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const user = process.env.SMTP_USER;
// Do NOT print password

if (!host || !user) {
  console.error('SMTP_HOST or SMTP_USER is not set in environment.');
  process.exit(2);
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: {
    user,
    pass: process.env.SMTP_PASSWORD,
  },
});

console.log('Attempting SMTP verify with:', { host, port, secure, user });

transporter.verify((err, success) => {
  if (err) {
    console.error('SMTP verify failed:', err && err.message);
    process.exit(1);
  }
  console.log('SMTP verify succeeded');
  process.exit(0);
});
