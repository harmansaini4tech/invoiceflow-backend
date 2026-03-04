const router = require('express').Router();
const { protect } = require('../middlewares/authMiddleware');
const Subscription = require('../models/Subscription');
const Expense = require('../models/Expense');
const { success, paginated } = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');

router.use(protect);

// Plan check middleware inline
const requireExpenseAccess = async (req, res, next) => {
  // Skip in development
  if (process.env.NODE_ENV === 'development') return next();

  const sub = await Subscription.findOne({ company: req.companyId });
  if (!sub || !['pro', 'business'].includes(sub.plan)) {
    return res.status(403).json({
      success: false,
      code: 'PLAN_UPGRADE_REQUIRED',
      message: 'Expense tracking requires a Pro or Business plan.',
      requiredPlans: ['pro', 'business'],
      currentPlan: sub?.plan || 'free',
    });
  }
  next();
};

router.get('/', requireExpenseAccess, async (req, res) => {
  const { page = 1, limit = 20, category, startDate, endDate } = req.query;
  const query = { company: req.companyId };
  if (category) query.category = category;
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }
  const total = await Expense.countDocuments(query);
  const expenses = await Expense.find(query)
    .populate('createdBy', 'name')
    .sort('-date').skip((page - 1) * limit).limit(+limit);
  paginated(res, expenses, { page: +page, limit: +limit, total, pages: Math.ceil(total / limit) });
});

router.post('/', requireExpenseAccess, async (req, res) => {
  const expense = await Expense.create({
    ...req.body, company: req.companyId, createdBy: req.user._id,
  });
  success(res, expense, 'Expense recorded', 201);
});

router.put('/:id', requireExpenseAccess, async (req, res) => {
  const expense = await Expense.findOneAndUpdate(
    { _id: req.params.id, company: req.companyId },
    req.body, { new: true }
  );
  if (!expense) throw new ApiError('Expense not found', 404);
  success(res, expense, 'Expense updated');
});

router.delete('/:id', requireExpenseAccess, async (req, res) => {
  const expense = await Expense.findOne({ _id: req.params.id, company: req.companyId });
  if (!expense) throw new ApiError('Expense not found', 404);
  await expense.deleteOne();
  success(res, null, 'Expense deleted');
});

module.exports = router;