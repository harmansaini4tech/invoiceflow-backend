const nodemailer = require("nodemailer");
const logger = require("../utils/logger");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: +process.env.EMAIL_PORT,
  secure: false,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

const templates = {
  verifyEmail: ({ name, verifyURL }) => ({
    subject: "Verify your InvoiceFlow account",
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#DC2626;padding:20px;text-align:center">
        <h1 style="color:white;margin:0">InvoiceFlow</h1>
      </div>
      <div style="padding:30px">
        <h2>Hello ${name}!</h2>
        <p>Please verify your email to activate your account.</p>
        <a href="${verifyURL}" style="background:#DC2626;color:white;padding:12px 30px;text-decoration:none;border-radius:6px;display:inline-block;margin:20px 0">Verify Email</a>
        <p style="color:#666;font-size:14px">Link expires in 24 hours.</p>
      </div>
    </div>`,
  }),
  resetPassword: ({ name, resetURL }) => ({
    subject: "Password Reset Request",
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#DC2626;padding:20px;text-align:center">
        <h1 style="color:white;margin:0">InvoiceFlow</h1>
      </div>
      <div style="padding:30px">
        <h2>Hello ${name}!</h2>
        <p>You requested a password reset.</p>
        <a href="${resetURL}" style="background:#DC2626;color:white;padding:12px 30px;text-decoration:none;border-radius:6px;display:inline-block;margin:20px 0">Reset Password</a>
        <p style="color:#666;font-size:14px">Link expires in 10 minutes. Ignore if you didn't request this.</p>
      </div>
    </div>`,
  }),
  invoiceEmail: ({ invoice, company }) => ({
    subject: `Invoice ${invoice.invoiceNumber} from ${company.name}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#DC2626;padding:20px;text-align:center">
        <h1 style="color:white;margin:0">${company.name}</h1>
      </div>
      <div style="padding:30px">
        <h2>Invoice ${invoice.invoiceNumber}</h2>
        <p>Dear ${invoice.customer.name},</p>
        <p>Please find attached invoice for <strong>$${invoice.total.toFixed(
          2
        )}</strong></p>
        <p>Due Date: <strong>${new Date(
          invoice.dueDate
        ).toLocaleDateString()}</strong></p>
        <a href="${process.env.FRONTEND_URL}/invoice/view/${
      invoice.publicToken
    }"
          style="background:#DC2626;color:white;padding:12px 30px;text-decoration:none;border-radius:6px;display:inline-block;margin:20px 0">
          View Invoice
        </a>
      </div>
    </div>`,
  }),
};

exports.sendEmail = async ({ to, template, data, attachments }) => {
  const tpl = templates[template](data);
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: tpl.subject,
    html: tpl.html,
    ...(attachments && { attachments }),
  });
  logger.info(`📧 Email sent to ${to} — ${tpl.subject}`);
};

exports.sendInvoiceEmail = async (invoice) => {
  await exports.sendEmail({
    to: invoice.customer.email,
    template: "invoiceEmail",
    data: { invoice, company: invoice.company },
  });
};
