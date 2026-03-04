const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  const conn = await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
};

module.exports = { connectDB };