const ApiError = require('../utils/ApiError');

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    throw new ApiError(`Role '${req.user.role}' is not authorized`, 403);
  }
  next();
};

module.exports = { authorize };