const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: {
    type: String,
    enum: ['overdue_invoice', 'payment_received', 'invoice_sent', 'customer_added'],
    required: true,
  },
  title:   { type: String, required: true },
  message: { type: String, required: true },
  read:    { type: Boolean, default: false },
  link:    { type: String }, // e.g. /invoices/:id
  meta:    { type: Object }, // extra data like invoiceNumber, customerName
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);