require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const { connectDB } = require('./config/database');
const { errorHandler, notFound } = require('./middlewares/errorMiddleware');
const logger = require('./utils/logger');

const app = express();

// Security
app.use(helmet());
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

// Rate limiting
app.use('/api/', rateLimit({
  windowMs: +process.env.RATE_LIMIT_WINDOW_MS || 900000,
  max: +process.env.RATE_LIMIT_MAX || 100,
  message: { success: false, message: 'Too many requests' },
}));

// Stripe webhook (raw body BEFORE json parser)
app.use('/api/v1/webhooks',
  express.raw({ type: 'application/json' }),
  require('./routes/webhookRoutes')
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

app.get('/health', (_, res) => res.json({ success: true }));

const API = `/api/${process.env.API_VERSION || 'v1'}`;
const authLimiter = rateLimit({ windowMs: 900000, max: 20,
  message: { success: false, message: 'Too many auth attempts' } });

app.use(`${API}/auth`,         authLimiter, require('./routes/authRoutes'));
app.use(`${API}/users`,        require('./routes/userRoutes'));
app.use(`${API}/company`,      require('./routes/companyRoutes'));
app.use(`${API}/customers`,    require('./routes/customerRoutes'));
app.use(`${API}/invoices`,     require('./routes/invoiceRoutes'));
app.use(`${API}/quotes`,       require('./routes/quoteRoutes'));
app.use(`${API}/expenses`,     require('./routes/expenseRoutes'));
app.use(`${API}/subscriptions`,require('./routes/subscriptionRoutes'));
app.use(`${API}/dashboard`,    require('./routes/dashboardRoutes'));
app.use(`${API}/super-admin`,  require('./routes/superAdminRoutes'));

app.use(notFound);
app.use(errorHandler);

connectDB().then(() => {
  app.listen(process.env.PORT || 5000, () =>
    logger.info(`🚀 Server running on port ${process.env.PORT || 5000}`));
});

process.on('unhandledRejection', err => { logger.error(err); process.exit(1); });
module.exports = app;