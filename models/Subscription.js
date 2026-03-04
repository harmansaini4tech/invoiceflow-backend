const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      unique: true,
    },
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    plan: { type: String, enum: ["free", "pro", "business"], default: "free" },
    billingCycle: { type: String, enum: ["monthly", "yearly"] },
    status: {
      type: String,
      enum: ["active", "cancelled", "past_due", "trialing", "inactive"],
      default: "active",
    },
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    cancelAtPeriodEnd: { type: Boolean, default: false },
    invoiceCount: { type: Number, default: 0 },
    limits: {
      invoices: { type: Number, default: 5 }, // free=5, pro=unlimited(-1), biz=unlimited
      customers: { type: Number, default: 10 },
      users: { type: Number, default: 1 },
      storage: { type: Number, default: 50 }, // MB
    },
    features: {
      customBranding: { type: Boolean, default: false },
      recurringInvoices: { type: Boolean, default: false },
      expenseTracking: { type: Boolean, default: false },
      apiAccess: { type: Boolean, default: false },
      prioritySupport: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subscription", subscriptionSchema);
