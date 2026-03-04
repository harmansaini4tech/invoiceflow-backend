const mongoose = require('mongoose');

const quoteSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  quoteNumber: { type: String, required: true },
  status: { type: String, enum: ['draft','sent','accepted','declined','expired'], default: 'draft' },
  issueDate: { type: Date, default: Date.now },
  expiryDate: Date,
  lineItems: [{
    description: String, quantity: Number, rate: Number,
    discount: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 }, amount: Number,
  }],
  subtotal: Number, taxAmount: Number, discountAmount: Number, total: Number,
  currency: { type: String, default: 'USD' },
  notes: String, terms: String,
  convertedToInvoice: { type: Boolean, default: false },
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
}, { timestamps: true });

module.exports = mongoose.model('Quote', quoteSchema);