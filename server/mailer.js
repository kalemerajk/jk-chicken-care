const nodemailer = require('nodemailer');

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

let transporter = null;

if (GMAIL_USER && GMAIL_APP_PASSWORD) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });
} else {
  console.warn(
    'Email notifications are OFF: set GMAIL_USER and GMAIL_APP_PASSWORD in server/.env to enable them.'
  );
}

/**
 * Sends an order status update email to a customer.
 * Fails silently (logs a warning) if email isn't configured or sending fails,
 * so a broken mail setup never blocks the accept/reject action itself.
 */
async function sendOrderStatusEmail({ to, customerName, quantity, status, reason }) {
  if (!transporter) return;

  const isAccepted = status === 'accepted';
  const subject = isAccepted
    ? `Your order for ${quantity} chickens has been accepted`
    : `Update on your order for ${quantity} chickens`;

  const bodyLines = [
    `Hi ${customerName},`,
    '',
    isAccepted
      ? `Good news — your order for ${quantity} chicken(s) has been accepted. We'll be in touch about delivery.`
      : `Your order for ${quantity} chicken(s) was not accepted this time.`,
  ];

  if (!isAccepted && reason) {
    bodyLines.push('', `Reason: ${reason}`);
  }

  bodyLines.push('', 'Thank you for choosing JK Chicken Care.');

  try {
    await transporter.sendMail({
      from: `"JK Chicken Care" <${GMAIL_USER}>`,
      to,
      subject,
      text: bodyLines.join('\n'),
    });
  } catch (err) {
    console.warn('Failed to send order status email:', err.message);
  }
}

module.exports = { sendOrderStatusEmail };
