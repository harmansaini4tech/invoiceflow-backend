const stripe = require('../config/stripe');
const Subscription = require('../models/Subscription');
const ApiError = require('../utils/ApiError');
const { success } = require('../utils/ApiResponse');

const PLAN_PRICES = {
  pro:      { monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,       yearly: process.env.STRIPE_PRICE_PRO_YEARLY },
  business: { monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY,  yearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY },
};

const PLAN_LIMITS = {
  free:     { invoices: 5,  customers: 10,  users: 1,  features: {} },
  pro:      { invoices: -1, customers: -1,  users: 5,  features: { customBranding: true, recurringInvoices: true } },
  business: { invoices: -1, customers: -1,  users: -1, features: { customBranding: true, recurringInvoices: true, expenseTracking: true, apiAccess: true, prioritySupport: true } },
};

exports.getSubscription = async (req, res) => {
  const sub = await Subscription.findOne({ company: req.companyId });
  success(res, sub);
};

exports.createCheckout = async (req, res) => {
  const { plan, billingCycle } = req.body;
  if (!PLAN_PRICES[plan]) throw new ApiError('Invalid plan', 400);

  const priceId = PLAN_PRICES[plan][billingCycle];
  let sub = await Subscription.findOne({ company: req.companyId });

  let customerId = sub?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: req.user.email,
      name: req.user.name,
      metadata: { companyId: req.companyId.toString() },
    });
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: `${process.env.FRONTEND_URL}/dashboard?upgraded=true`,
    cancel_url: `${process.env.FRONTEND_URL}/pricing?cancelled=true`,
    metadata: { companyId: req.companyId.toString(), plan, billingCycle },
  });

  success(res, { url: session.url });
};

exports.cancelSubscription = async (req, res) => {
  const sub = await Subscription.findOne({ company: req.companyId });
  if (!sub?.stripeSubscriptionId) throw new ApiError('No active subscription', 400);

  await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
  sub.cancelAtPeriodEnd = true;
  await sub.save();
  success(res, sub, 'Subscription will cancel at period end');
};

exports.getPortalUrl = async (req, res) => {
  const sub = await Subscription.findOne({ company: req.companyId });
  if (!sub?.stripeCustomerId) throw new ApiError('No Stripe customer', 400);

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${process.env.FRONTEND_URL}/settings/billing`,
  });
  success(res, { url: session.url });
};