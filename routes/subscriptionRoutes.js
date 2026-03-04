const router = require('express').Router();
const { protect } = require('../middlewares/authMiddleware');
const {
  getSubscription, createCheckout, cancelSubscription, getPortalUrl
} = require('../controllers/subscriptionController');

router.use(protect);
router.get('/', getSubscription);
router.post('/checkout', createCheckout);
router.post('/cancel', cancelSubscription);
router.get('/portal', getPortalUrl);

module.exports = router;