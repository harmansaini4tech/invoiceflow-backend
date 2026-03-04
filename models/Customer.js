const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, lowercase: true, trim: true },
  phone: String,
  address: { street: String, city: String, state: String, country: String, zip: String },
  taxNumber: String,
  currency: { type: String, default: 'USD' },
  notes: String,
  tags: [String],
  totalInvoiced: { type: Number, default: 0 },
  totalPaid: { type: Number, default: 0 },
  totalOutstanding: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

customerSchema.index({ company: 1, email: 1 });
customerSchema.index({ company: 1, name: 'text', email: 'text' });

module.exports = mongoose.model('Customer', customerSchema);