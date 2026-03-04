const router = require('express').Router();
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const Company = require('../models/Company');
const { upload } = require('../config/cloudinary');
const { success } = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');

// GET /api/v1/company
router.get('/', protect, async (req, res) => {
  const company = await Company.findById(req.companyId);
  if (!company) throw new ApiError('Company not found', 404);
  success(res, company);
});

// PUT /api/v1/company
router.put('/', protect, authorize('owner', 'admin'), async (req, res) => {
  const company = await Company.findByIdAndUpdate(req.companyId, req.body, {
    new: true, runValidators: true,
  });
  success(res, company, 'Company updated');
});

// POST /api/v1/company/logo
router.post('/logo', protect, authorize('owner', 'admin'), upload.single('logo'), async (req, res) => {
  if (!req.file) throw new ApiError('No file uploaded', 400);
  const company = await Company.findByIdAndUpdate(
    req.companyId,
    { logo: { url: req.file.path, publicId: req.file.filename } },
    { new: true }
  );
  success(res, company, 'Logo uploaded');
});

module.exports = router;