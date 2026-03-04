const Subscription = require('../models/Subscription');
const ApiError = require('../utils/ApiError');

const checkPlan = (...requiredPlans) => async (req, res, next) => {
  // ✅ Skip plan check in development mode
  if (process.env.NODE_ENV === 'development') return next();

  const sub = await Subscription.findOne({ company: req.companyId });
  if (!sub || !requiredPlans.includes(sub.plan)) {
    throw new ApiError(
      `This feature requires a ${requiredPlans.join(' or ')} plan. Please upgrade.`,
      403
    );
  }
  req.subscription = sub;
  next();
};

const checkInvoiceLimit = async (req, res, next) => {
  // ✅ Skip invoice limit in development mode
  if (process.env.NODE_ENV === 'development') return next();

  const sub = await Subscription.findOne({ company: req.companyId });
  if (!sub) throw new ApiError('Subscription not found', 404);
  if (sub.limits.invoices !== -1 && sub.invoiceCount >= sub.limits.invoices) {
    throw new ApiError(
      `You've reached your ${sub.plan} plan limit (${sub.limits.invoices} invoices). Upgrade to create more.`,
      403
    );
  }
  req.subscription = sub;
  next();
};

module.exports = { checkPlan, checkInvoiceLimit };