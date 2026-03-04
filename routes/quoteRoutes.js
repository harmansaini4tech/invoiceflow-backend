const router = require('express').Router();
const { protect } = require('../middlewares/authMiddleware');
const Quote = require('../models/Quote');
const Invoice = require('../models/Invoice');
const { success, paginated } = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { generateInvoiceNumber } = require('../services/invoiceNumberService');
const { v4: uuidv4 } = require('uuid');

router.use(protect);

router.get('/', async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const query = { company: req.companyId };
  const total = await Quote.countDocuments(query);
  const quotes = await Quote.find(query)
    .populate('customer', 'name email')
    .sort('-createdAt').skip((page - 1) * limit).limit(+limit);
  paginated(res, quotes, { page: +page, limit: +limit, total, pages: Math.ceil(total / limit) });
});

router.post('/', async (req, res) => {
  const count = await Quote.countDocuments({ company: req.companyId });
  const quoteNumber = `QUO-${String(count + 1).padStart(4, '0')}`;
  const quote = await Quote.create({ ...req.body, company: req.companyId, quoteNumber });
  success(res, quote, 'Quote created', 201);
});

router.get('/:id', async (req, res) => {
  const quote = await Quote.findOne({ _id: req.params.id, company: req.companyId })
    .populate('customer');
  if (!quote) throw new ApiError('Quote not found', 404);
  success(res, quote);
});

router.put('/:id', async (req, res) => {
  const quote = await Quote.findOneAndUpdate(
    { _id: req.params.id, company: req.companyId },
    req.body, { new: true }
  );
  if (!quote) throw new ApiError('Quote not found', 404);
  success(res, quote, 'Quote updated');
});

router.delete('/:id', async (req, res) => {
  const quote = await Quote.findOne({ _id: req.params.id, company: req.companyId });
  if (!quote) throw new ApiError('Quote not found', 404);
  await quote.deleteOne();
  success(res, null, 'Quote deleted');
});

// POST /api/v1/quotes/:id/convert — convert quote to invoice
router.post('/:id/convert', async (req, res) => {
  const quote = await Quote.findOne({ _id: req.params.id, company: req.companyId });
  if (!quote) throw new ApiError('Quote not found', 404);
  if (quote.convertedToInvoice) throw new ApiError('Already converted to invoice', 400);

  const invoiceNumber = await generateInvoiceNumber(req.companyId);
  const invoice = await Invoice.create({
    company: req.companyId,
    customer: quote.customer,
    invoiceNumber,
    lineItems: quote.lineItems,
    subtotal: quote.subtotal,
    taxAmount: quote.taxAmount,
    discountAmount: quote.discountAmount,
    total: quote.total,
    balanceDue: quote.total,
    currency: quote.currency,
    notes: quote.notes,
    terms: quote.terms,
    issueDate: new Date(),
    dueDate: req.body.dueDate || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    publicToken: uuidv4(),
    status: 'draft',
  });

  quote.convertedToInvoice = true;
  quote.invoiceId = invoice._id;
  await quote.save();

  success(res, invoice, 'Quote converted to invoice', 201);
});

module.exports = router;