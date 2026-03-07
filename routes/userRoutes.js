const router = require("express").Router();
const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");
const User = require("../models/User");
const { success } = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");

// GET /api/v1/users — owner/admin only
router.get(
  "/",
  protect,
  authorize("owner", "admin", "superadmin"),
  async (req, res) => {
    const users = await User.find({ company: req.companyId }).select(
      "-password"
    );
    success(res, users);
  }
);

// PATCH /api/v1/users/:id — update role
router.patch(
  "/:id",
  protect,
  authorize("owner", "superadmin"),
  async (req, res) => {
    const user = await User.findOne({
      _id: req.params.id,
      company: req.companyId,
    });
    if (!user) throw new ApiError("User not found", 404);
    if (req.body.role) user.role = req.body.role;
    if (req.body.isActive !== undefined) user.isActive = req.body.isActive;
    await user.save();
    success(res, user, "User updated");
  }
);

// PATCH /api/v1/users/me/password
router.patch("/me/password", protect, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    throw new ApiError("Both fields are required", 400);
  if (newPassword.length < 8)
    throw new ApiError("Password must be at least 8 characters", 400);

  const user = await User.findById(req.user._id).select("+password");
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) throw new ApiError("Current password is incorrect", 401);

  user.password = newPassword;
  await user.save();
  success(res, null, "Password updated successfully");
});

// DELETE /api/v1/users/:id
router.delete(
  "/:id",
  protect,
  authorize("owner", "superadmin"),
  async (req, res) => {
    const user = await User.findOne({
      _id: req.params.id,
      company: req.companyId,
    });
    if (!user) throw new ApiError("User not found", 404);
    if (user._id.toString() === req.user._id.toString())
      throw new ApiError("Cannot delete yourself", 400);
    await user.deleteOne();
    success(res, null, "User removed");
  }
);

module.exports = router;
