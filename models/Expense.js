const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  category: {
    type: String,
    enum: ['travel','food','utilities','software','hardware','marketing','salary','other'],
    required: true,
  },
  description: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'USD' },
  date: { type: Date, default: Date.now },
  receipt: { url: String, publicId: String },
  vendor: String,
  notes: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);