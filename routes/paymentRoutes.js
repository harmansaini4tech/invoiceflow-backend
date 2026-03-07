const router   = require('express').Router();
const Invoice  = require('../models/Invoice');
const Customer = require('../models/Customer');
const { protect }           = require('../middlewares/authMiddleware');
const { createNotification } = require('../services/notificationService');
const { createPaymentIntent, constructWebhookEvent } = require('../services/stripeService');
const { success } = require('../utils/ApiResponse');
const ApiError    = require('../utils/ApiError');

// ── POST /api/v1/payments/create-intent ──────────────────────────────────────
// Called from public invoice page — no auth needed
router.post('/create-intent', async (req, res) => {
  const { invoiceId } = req.body;
  if (!invoiceId) throw new ApiError('Invoice ID required', 400);

  const invoice = await Invoice.findById(invoiceId)
    .populate('customer', 'name email');
  if (!invoice) throw new ApiError('Invoice not found', 404);
  if (invoice.status === 'paid') throw new ApiError('Invoice already paid', 400);
  if (invoice.balanceDue <= 0)   throw new ApiError('No balance due', 400);

  const paymentIntent = await createPaymentIntent({
    amount:        invoice.balanceDue,
    currency:      invoice.currency || 'usd',
    invoiceId:     invoice._id.toString(),
    invoiceNumber: invoice.invoiceNumber,
    customerEmail: invoice.customer?.email,
  });

  // Save intent ID to invoice
  invoice.stripePaymentIntentId = paymentIntent.id;
  await invoice.save();

  success(res, {
    clientSecret:      paymentIntent.client_secret,
    publishableKey:    process.env.STRIPE_PUBLISHABLE_KEY,
    amount:            invoice.balanceDue,
    currency:          invoice.currency || 'USD',
    invoiceNumber:     invoice.invoiceNumber,
  });
});

// ── POST /api/v1/payments/record ─────────────────────────────────────────────
// Record a manual payment — requires auth
router.post('/record', protect, async (req, res) => {
  const { invoiceId, amount, method, reference, note } = req.body;

  if (!invoiceId || !amount) throw new ApiError('Invoice ID and amount required', 400);
  if (amount <= 0)           throw new ApiError('Amount must be greater than 0', 400);

  const invoice = await Invoice.findOne({
    _id:     invoiceId,
    company: req.companyId,
  });
  if (!invoice) throw new ApiError('Invoice not found', 404);
  if (invoice.status === 'paid') throw new ApiError('Invoice already fully paid', 400);
  if (amount > invoice.balanceDue)
    throw new ApiError(`Amount exceeds balance due ($${invoice.balanceDue.toFixed(2)})`, 400);

  // Add payment record
  invoice.payments.push({
    amount,
    method:     method || 'manual',
    reference:  reference || '',
    note:       note || '',
    paidAt:     new Date(),
    recordedBy: req.user._id,
  });

  // Update totals
  invoice.amountPaid  = (invoice.amountPaid || 0) + amount;
  invoice.balanceDue  = Math.max(0, (invoice.balanceDue || 0) - amount);

  // Auto mark as paid if fully paid
  if (invoice.balanceDue === 0) {
    invoice.status = 'paid';
    invoice.paidAt = new Date();

    await Customer.findByIdAndUpdate(invoice.customer, {
      $inc: { totalPaid: invoice.amountPaid, totalOutstanding: -invoice.amountPaid },
    });

    await createNotification({
      company: req.companyId,
      type:    'payment_received',
      title:   'Invoice Fully Paid',
      message: `Invoice ${invoice.invoiceNumber} is now fully paid`,
      link:    `/invoices/${invoice._id}`,
      meta:    { invoiceNumber: invoice.invoiceNumber, amount: invoice.amountPaid },
    });
  }

  await invoice.save();
  success(res, invoice, 'Payment recorded');
});

// ── GET /api/v1/payments/:invoiceId/history ──────────────────────────────────
router.get('/:invoiceId/history', protect, async (req, res) => {
  const invoice = await Invoice.findOne({
    _id:     req.params.invoiceId,
    company: req.companyId,
  }).populate('payments.recordedBy', 'name');
  if (!invoice) throw new ApiError('Invoice not found', 404);
  success(res, {
    payments:   invoice.payments || [],
    amountPaid: invoice.amountPaid || 0,
    balanceDue: invoice.balanceDue || 0,
    total:      invoice.total,
  });
});

// ── POST /api/v1/payments/webhook ────────────────────────────────────────────
// Stripe webhook — raw body needed
router.post('/webhook',
  require('express').raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = constructWebhookEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Webhook signature failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
      const intent   = event.data.object;
      const invoiceId = intent.metadata?.invoiceId;
      if (!invoiceId) return res.json({ received: true });

      const invoice = await Invoice.findById(invoiceId);
      if (!invoice || invoice.status === 'paid') return res.json({ received: true });

      const paidAmount = intent.amount_received / 100;

      // Add payment record
      invoice.payments.push({
        amount:    paidAmount,
        method:    'stripe',
        reference: intent.id,
        note:      'Paid via Stripe',
        paidAt:    new Date(),
      });

      invoice.amountPaid = (invoice.amountPaid || 0) + paidAmount;
      invoice.balanceDue = Math.max(0, invoice.total - invoice.amountPaid);

      if (invoice.balanceDue === 0) {
        invoice.status = 'paid';
        invoice.paidAt = new Date();
      }

      await invoice.save();

      // Notify
      await createNotification({
        company: invoice.company,
        type:    'payment_received',
        title:   'Stripe Payment Received',
        message: `Payment of ${invoice.currency} ${paidAmount.toFixed(2)} received for Invoice ${invoice.invoiceNumber}`,
        link:    `/invoices/${invoice._id}`,
        meta:    { invoiceNumber: invoice.invoiceNumber, amount: paidAmount },
      });
    }

    res.json({ received: true });
  }
);

module.exports = router;