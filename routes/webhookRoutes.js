const router = require('express').Router();
const stripe = require('../config/stripe');
const Subscription = require('../models/Subscription');
const logger = require('../utils/logger');

const PLAN_LIMITS = {
  pro:      { invoices: -1, customers: -1, users: 5, features: { customBranding: true, recurringInvoices: true } },
  business: { invoices: -1, customers: -1, users: -1, features: { customBranding: true, recurringInvoices: true, expenseTracking: true, apiAccess: true, prioritySupport: true } },
};

router.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error(`Webhook signature failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const { companyId, plan, billingCycle } = event.data.object.metadata || {};

  switch (event.type) {
    case 'checkout.session.completed':
      if (companyId && plan) {
        const limits = PLAN_LIMITS[plan] || {};
        await Subscription.findOneAndUpdate(
          { company: companyId },
          {
            plan,
            billingCycle,
            status: 'active',
            stripeCustomerId: event.data.object.customer,
            stripeSubscriptionId: event.data.object.subscription,
            limits,
            features: limits.features || {},
            currentPeriodStart: new Date(),
          },
          { upsert: true }
        );
        logger.info(`✅ Subscription activated for company ${companyId} — Plan: ${plan}`);
      }
      break;

    case 'customer.subscription.deleted':
      if (companyId) {
        await Subscription.findOneAndUpdate(
          { stripeSubscriptionId: event.data.object.id },
          { plan: 'free', status: 'inactive', limits: { invoices: 5, customers: 10, users: 1 } }
        );
      }
      break;

    case 'invoice.payment_failed':
      await Subscription.findOneAndUpdate(
        { stripeCustomerId: event.data.object.customer },
        { status: 'past_due' }
      );
      break;
  }

  res.json({ received: true });
});

module.exports = router;