const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Company = require('../models/Company');
const Subscription = require('../models/Subscription');
const ApiError = require('../utils/ApiError');
const { success } = require('../utils/ApiResponse');
const { sendEmail } = require('../services/emailService');

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

const PLAN_DEFAULTS = {
  free:     { invoices: 5, customers: 10, users: 1 },
  pro:      { invoices: -1, customers: -1, users: 5 },
  business: { invoices: -1, customers: -1, users: -1 },
};

// POST /api/v1/auth/register
exports.register = async (req, res) => {
  const { name, email, password, companyName } = req.body;

  if (!name || !email || !password) {
    throw new ApiError('Name, email and password are required', 400);
  }

  const exists = await User.findOne({ email });
  if (exists) throw new ApiError('Email already registered', 400);

  // 1. Create user first (without company)
  const user = await User.create({ name, email, password, role: 'owner' });

  // 2. Create company with the real user._id as owner
  const company = await Company.create({
    name: companyName || `${name}'s Company`,
    email,
    owner: user._id,
  });

  // 3. Attach company to user
  user.company = company._id;
  await user.save({ validateBeforeSave: false });

  // 4. Create free subscription
  await Subscription.create({
    company: company._id,
    plan: 'free',
    status: 'active',
    invoiceCount: 0,
    limits: { invoices: 5, customers: 10, users: 1 },
    features: {
      customBranding: false,
      recurringInvoices: false,
      expenseTracking: false,
      apiAccess: false,
      prioritySupport: false,
    },
  });

  const token = generateToken(user._id);

  success(res, {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      company: company._id,
    },
  }, 'Registered successfully', 201);
};

// POST /api/v1/auth/login
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError('Please provide email and password', 400);
  }

  // Must explicitly select password since it's select:false in schema
  const user = await User.findOne({ email }).select('+password').populate('company');

  if (!user) {
    throw new ApiError('Invalid email or password', 401);
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new ApiError('Invalid email or password', 401);
  }

  if (!user.isActive) {
    throw new ApiError('Account deactivated. Contact support.', 403);
  }

  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  const token = generateToken(user._id);

  success(res, {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      company: user.company,
    },
  }, 'Login successful');
};

// POST /api/v1/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) throw new ApiError('No account with that email', 404);

  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
  await sendEmail({
    to: user.email,
    subject: 'Password Reset Request',
    template: 'resetPassword',
    data: { name: user.name, resetURL },
  });

  success(res, null, 'Password reset email sent');
};

// PATCH /api/v1/auth/reset-password/:token
exports.resetPassword = async (req, res) => {
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  if (!user) throw new ApiError('Token is invalid or has expired', 400);

  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  const token = generateToken(user._id);
  success(res, { token }, 'Password reset successful');
};

// GET /api/v1/auth/me
exports.getMe = async (req, res) => {
  const user = await User.findById(req.user._id).populate('company');
  const subscription = await Subscription.findOne({ company: req.companyId });
  success(res, { user, subscription });
};

// POST /api/v1/auth/logout
exports.logout = (req, res) => success(res, null, 'Logged out successfully');