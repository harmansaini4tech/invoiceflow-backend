const mongoose = require("mongoose");

const lineItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    rate: { type: Number, required: true, min: 0 },
    unit: String,
    discount: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    amount: { type: Number, required: true },
  },
  { _id: true }
);

const invoiceSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    invoiceNumber: { type: String, required: true },
    status: {
      type: String,
      enum: ["draft", "sent", "paid", "overdue", "cancelled", "partial"],
      default: "draft",
    },
    type: {
      type: String,
      enum: ["invoice", "credit_note"],
      default: "invoice",
    },
    issueDate: { type: Date, required: true, default: Date.now },
    dueDate: { type: Date, required: true },
    lineItems: [lineItemSchema],
    subtotal: { type: Number, required: true },
    discountType: {
      type: String,
      enum: ["percent", "fixed"],
      default: "percent",
    },
    discountValue: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    shippingCharge: { type: Number, default: 0 },
    total: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
    balanceDue: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    notes: String,
    terms: String,
    customFields: [{ label: String, value: String }],
    isRecurring: { type: Boolean, default: false },
    recurringInterval: {
      type: String,
      enum: ["weekly", "monthly", "quarterly", "yearly"],
    },
    recurringEndDate: Date,
    nextRecurringDate: Date,
    parentInvoice: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice" },
    emailSentAt: Date,
    viewedAt: Date,
    paidAt: Date,
    publicToken: {
      type: String,
      default: () => crypto.randomBytes(32).toString("hex"),
      unique: true,
    },
    template: {
      type: String,
      enum: ["modern", "classic", "minimal"],
      default: "modern",
    },
    tags: [String],
    payments: [
      {
        amount: { type: Number, required: true },
        method: {
          type: String,
          enum: ["stripe", "manual", "bank", "cash", "upi", "other"],
          default: "manual",
        },
        reference: { type: String }, // Stripe payment intent ID or manual ref
        note: { type: String },
        paidAt: { type: Date, default: Date.now },
        recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],
    amountPaid: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },
    stripePaymentIntentId: { type: String },
  },
  { timestamps: true }
);

invoiceSchema.index({ company: 1, status: 1 });
invoiceSchema.index({ company: 1, customer: 1 });
invoiceSchema.index({ company: 1, dueDate: 1 });
invoiceSchema.index({ company: 1, invoiceNumber: 1 }, { unique: true });

module.exports = mongoose.model("Invoice", invoiceSchema);
