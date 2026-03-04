const router = require('express').Router();
const { protect } = require('../middlewares/authMiddleware');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const { success, paginated } = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');

router.use(protect);

// GET /api/v1/customers
router.get('/', async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  const query = { company: req.companyId };
  if (search) query.$text = { $search: search };

  const total = await Customer.countDocuments(query);
  const customers = await Customer.find(query)
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(+limit);

  paginated(res, customers, { page: +page, limit: +limit, total, pages: Math.ceil(total / limit) });
});

// POST /api/v1/customers
router.post('/', async (req, res) => {
  const customer = await Customer.create({ ...req.body, company: req.companyId });
  success(res, customer, 'Customer created', 201);
});

// GET /api/v1/customers/:id
router.get('/:id', async (req, res) => {
  const customer = await Customer.findOne({ _id: req.params.id, company: req.companyId });
  if (!customer) throw new ApiError('Customer not found', 404);
  const invoices = await Invoice.find({ customer: req.params.id, company: req.companyId })
    .sort('-createdAt').limit(10).select('invoiceNumber status total dueDate');
  success(res, { customer, invoices });
});

// PUT /api/v1/customers/:id
router.put('/:id', async (req, res) => {
  const customer = await Customer.findOneAndUpdate(
    { _id: req.params.id, company: req.companyId },
    req.body, { new: true, runValidators: true }
  );
  if (!customer) throw new ApiError('Customer not found', 404);
  success(res, customer, 'Customer updated');
});

// DELETE /api/v1/customers/:id
router.delete('/:id', async (req, res) => {
  const customer = await Customer.findOne({ _id: req.params.id, company: req.companyId });
  if (!customer) throw new ApiError('Customer not found', 404);
  await customer.deleteOne();
  success(res, null, 'Customer deleted');
});

module.exports = router;