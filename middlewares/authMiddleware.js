const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.query.token) {
    token = req.query.token;
  }
  if (!token) throw new ApiError("Not authorized, no token", 401);

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id).populate("company");
  if (!user || !user.isActive)
    throw new ApiError("User not found or deactivated", 401);

  req.user = user;
  req.companyId = user.company?._id; // Multi-tenant isolation
  next();
};

const protectSuperAdmin = async (req, res, next) => {
  await protect(req, res, async () => {
    if (req.user.role !== "superadmin")
      throw new ApiError("Super admin access required", 403);
    next();
  });
};

module.exports = { protect, protectSuperAdmin };
