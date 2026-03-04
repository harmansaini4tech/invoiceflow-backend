const mongoose = require("mongoose");

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, lowercase: true },
    phone: String,
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zip: String,
    },
    logo: { url: String, publicId: String },
    website: String,
    taxNumber: String,
    currency: { type: String, default: "USD" },
    timezone: { type: String, default: "UTC" },
    branding: {
      primaryColor: { type: String, default: "#DC2626" },
      template: {
        type: String,
        enum: ["modern", "classic", "minimal"],
        default: "modern",
      },
      showLogo: { type: Boolean, default: true },
      showPaymentTerms: { type: Boolean, default: true },
      showBankDetails: { type: Boolean, default: false },
      watermark: String,
    },
    bankDetails: {
      bankName: String,
      accountName: String,
      accountNumber: String,
      ifscSwift: String,
      upiId: String,
    },
    invoiceSettings: {
      prefix: { type: String, default: "INV" },
      nextNumber: { type: Number, default: 1 },
      dueDays: { type: Number, default: 15 },
      notes: String,
      terms: String,
      taxLabel: { type: String, default: "Tax" },
      enableGST: { type: Boolean, default: false },
      enableVAT: { type: Boolean, default: false },
    },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Company", companySchema);
