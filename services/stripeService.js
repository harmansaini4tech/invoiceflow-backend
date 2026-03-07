const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Create a payment intent for an invoice
exports.createPaymentIntent = async ({ amount, currency, invoiceId, invoiceNumber, customerEmail }) => {
  const paymentIntent = await stripe.paymentIntents.create({
    amount:   Math.round(amount * 100), // Stripe uses cents
    currency: (currency || 'usd').toLowerCase(),
    metadata: {
      invoiceId,
      invoiceNumber,
    },
    receipt_email: customerEmail,
    description:   `Payment for Invoice ${invoiceNumber}`,
  });
  return paymentIntent;
};

// Retrieve payment intent
exports.getPaymentIntent = async (paymentIntentId) => {
  return await stripe.paymentIntents.retrieve(paymentIntentId);
};

// Construct webhook event
exports.constructWebhookEvent = (payload, sig, secret) => {
  return stripe.webhooks.constructEvent(payload, sig, secret);
};