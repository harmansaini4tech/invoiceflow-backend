const router = require('express').Router();
const { protect } = require('../middlewares/authMiddleware');
const { getStats } = require('../controllers/dashboardController');

router.use(protect);
router.get('/stats', getStats);

module.exports = router;