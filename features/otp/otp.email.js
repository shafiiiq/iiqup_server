const logger = require('#shared/logger/logger');
const nodemailer = require('nodemailer');
const { createSecureOAuthTransporter } = require('#shared/email/email.oauth');
const { OTPTemplate } = require('./otp.template');

require('dotenv').config();

const normalizeEnvValue = (value = '') => String(value).replace(/"/g, '').trim();
const normalizeAppPassword = (value = '') => normalizeEnvValue(value).replace(/\s+/g, '');
const boolEnv = (value) => String(value || '').trim().toLowerCase() === 'true';

const createGmailTransporter = () => {
  const user = normalizeEnvValue(process.env.OTP_MAILER);
  const pass = normalizeAppPassword(process.env.GMAIL_APP_PASSWORD);

  if (!user || !pass) {
    throw new Error('Missing or invalid GMAIL_APP_PASSWORD or OTP_MAILER');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
};

const getFromEmail = () => normalizeEnvValue(process.env.OTP_MAILER) || 'noreply@alansari.com';

const sendOTPEmail = async (email, otp, username = '', demo_opr = false) => {
  if (!email?.includes('@')) throw new Error('Invalid email address');
  if (!otp || otp.length < 4) throw new Error('Invalid OTP');

  const methods = [
    {
      name: 'Gmail App Password',
      create: createGmailTransporter,
      enabled: !!(process.env.GMAIL_APP_PASSWORD && process.env.OTP_MAILER),
    },
    {
      name: 'Secure OAuth2',
      create: createSecureOAuthTransporter,
      enabled: true,
    },
  ];

  const errors = [];

  for (const method of methods) {
    if (!method.enabled) continue;

    try {
      const transporter = await method.create();
      await transporter.verify();

      const includeOtpInSubject = boolEnv(process.env.OTP_INCLUDE_IN_SUBJECT);
      const subjectBase = demo_opr ? `${username} Trying to login` : 'Your One-Time Password';
      const subject = includeOtpInSubject ? `${subjectBase}: ${otp}` : subjectBase;

      const info = await transporter.sendMail({
        from: `"Al Ansari" <${getFromEmail()}>`,
        to: email,
        subject,
        html: OTPTemplate(otp, username),
        text: `Your OTP is ${otp}. It expires in 5 minutes.`,
        replyTo: getFromEmail(),
        envelope: { from: getFromEmail(), to: email },
        headers: { 'List-Unsubscribe': `<mailto:${getFromEmail()}>` },
      });

      logger.info('[otp.email] sendOTPEmail', method.name);

      transporter.close();

      return {
        success: true,
        message: `OTP sent via ${method.name}`,
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
      };
    } catch (error) {
      const message = error?.message || String(error);
      logger.error('[otp.email] sendOTPEmail', message);
      errors.push(`${method.name}: ${message}`);
    }
  }

  throw new Error(`All methods failed: ${errors.join('; ')}`);
};

module.exports = {
  sendOTPEmail,
};