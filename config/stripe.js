const Stripe = require('stripe');
module.exports = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
// ```

// ---

// ## ✅ Final backend folder check

// After adding all files your structure should be:
// ```
// backend/
// ├── config/
// │   ├── database.js       ✅
// │   ├── cloudinary.js     ✅
// │   └── stripe.js         ✅ (add now)
// ├── controllers/
// │   ├── authController.js        ✅
// │   ├── dashboardController.js   ✅
// │   └── subscriptionController.js ✅
// ├── middlewares/
// │   ├── authMiddleware.js        ✅
// │   ├── errorMiddleware.js       ✅
// │   ├── roleMiddleware.js        ✅
// │   ├── subscriptionMiddleware.js ✅
// │   └── validateMiddleware.js   ✅
// ├── models/
// │   ├── User.js        ✅
// │   ├── Company.js     ✅
// │   ├── Customer.js    ✅
// │   ├── Invoice.js     ✅
// │   ├── Quote.js       ✅
// │   ├── Expense.js     ✅
// │   └── Subscription.js ✅
// ├── routes/
// │   ├── authRoutes.js         ✅
// │   ├── userRoutes.js         ✅ (add now)
// │   ├── companyRoutes.js      ✅ (add now)
// │   ├── customerRoutes.js     ✅ (add now)
// │   ├── invoiceRoutes.js      ✅
// │   ├── quoteRoutes.js        ✅ (add now)
// │   ├── expenseRoutes.js      ✅ (add now)
// │   ├── subscriptionRoutes.js ✅ (add now)
// │   ├── dashboardRoutes.js    ✅ (add now)
// │   ├── superAdminRoutes.js   ✅ (add now)
// │   └── webhookRoutes.js      ✅
// ├── services/
// │   ├── emailService.js           ✅
// │   ├── invoiceNumberService.js   ✅
// │   └── pdfService.js             ✅
// ├── utils/
// │   ├── ApiError.js    ✅
// │   ├── ApiResponse.js ✅
// │   └── logger.js      ✅
// ├── .env               ✅ (copy from .env.example and fill)
// ├── package.json       ✅
// └── server.js          ✅