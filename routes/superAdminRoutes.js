const router = require('express').Router();
const { protectSuperAdmin } = require('../middlewares/authMiddleware');
const User = require('../models/User');
const Company = require('../models/Company');
const Subscription = require('../models/Subscription');
const { success, paginated } = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');

router.use(protectSuperAdmin);

// GET all users
router.get('/users', async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const total = await User.countDocuments({ role: { $ne: 'superadmin' } });
  const users = await User.find({ role: { $ne: 'superadmin' } })
    .populate('company', 'name')
    .sort('-createdAt').skip((page - 1) * limit).limit(+limit);
  paginated(res, users, { page: +page, limit: +limit, total, pages: Math.ceil(total / limit) });
});

// GET all companies
router.get('/companies', async (req, res) => {
  const companies = await Company.find().populate('owner', 'name email').sort('-createdAt');
  success(res, companies);
});

// GET SaaS revenue stats
router.get('/stats', async (req, res) => {
  const [totalUsers, totalCompanies, subs] = await Promise.all([
    User.countDocuments({ role: { $ne: 'superadmin' } }),
    Company.countDocuments(),
    Subscription.aggregate([
      { $group: { _id: '$plan', count: { $sum: 1 } } }
    ]),
  ]);
  success(res, { totalUsers, totalCompanies, planBreakdown: subs });
});

// PATCH suspend/activate user
router.patch('/users/:id/toggle', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError('User not found', 404);
  user.isActive = !user.isActive;
  await user.save();
  success(res, user, `User ${user.isActive ? 'activated' : 'suspended'}`);
});

// PATCH override subscription plan
router.patch('/companies/:id/plan', async (req, res) => {
  const { plan } = req.body;
  const LIMITS = {
    free:     { invoices: 5,  customers: 10,  users: 1 },
    pro:      { invoices: -1, customers: -1,  users: 5 },
    business: { invoices: -1, customers: -1,  users: -1 },
  };
  const sub = await Subscription.findOneAndUpdate(
    { company: req.params.id },
    { plan, limits: LIMITS[plan] || LIMITS.free },
    { new: true, upsert: true }
  );
  success(res, sub, `Plan set to ${plan}`);
});

module.exports = router;