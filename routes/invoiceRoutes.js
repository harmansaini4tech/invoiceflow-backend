const router = require('express').Router();
const ctrl = require('../controllers/invoiceController');
const { protect } = require('../middlewares/authMiddleware');
const { checkInvoiceLimit } = require('../middlewares/subscriptionMiddleware');

router.use(protect);
router.get('/', ctrl.getInvoices);
router.post('/', checkInvoiceLimit, ctrl.createInvoice);
router.get('/:id', ctrl.getInvoice);
router.put('/:id', ctrl.updateInvoice);
router.delete('/:id', ctrl.deleteInvoice);
router.post('/:id/send', ctrl.sendInvoice);
router.get('/:id/pdf', ctrl.downloadPDF);
router.post('/:id/duplicate', checkInvoiceLimit, ctrl.duplicateInvoice);
router.patch('/:id/mark-paid', ctrl.markPaid);

module.exports = router;