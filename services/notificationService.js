const Notification = require('../models/Notification');
const { pushToClients } = require('./sseService'); // ✅ direct import

exports.createNotification = async ({ company, type, title, message, link, meta }) => {
  try {
    const notification = await Notification.create({
      company, type, title, message, link, meta,
    });

    // ✅ Push real-time SSE
    pushToClients(company.toString(), notification);

    return notification;
  } catch (err) {
    console.error('createNotification error:', err);
  }
};