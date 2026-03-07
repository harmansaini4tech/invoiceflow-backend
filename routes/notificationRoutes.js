const router = require("express").Router();
const Notification = require("../models/Notification");
const { protect } = require("../middlewares/authMiddleware");
const { success } = require("../utils/ApiResponse");
const Invoice = require("../models/Invoice");
const { pushToClients, addClient, removeClient } = require("../services/sseService"); // ✅

// ✅ GET /api/v1/notifications/stream — SSE real-time
router.get("/stream", protect, (req, res) => {
  res.setHeader("Content-Type",      "text/event-stream");
  res.setHeader("Cache-Control",     "no-cache");
  res.setHeader("Connection",        "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const companyId = req.companyId.toString();

  // Send initial ping
  res.write('data: {"type":"connected"}\n\n');

  // ✅ Add to global store
  addClient(companyId, res);

  // Heartbeat every 30s
  const heartbeat = setInterval(() => {
    res.write('data: {"type":"ping"}\n\n');
  }, 30000);

  // Cleanup
  req.on("close", () => {
    clearInterval(heartbeat);
    removeClient(companyId, res);
  });
});

// check-overdue
router.post("/check-overdue", protect, async (req, res) => {
  const companyId = req.companyId;

  const overdueInvoices = await Invoice.find({
    company: companyId,
    status: "sent",
    dueDate: { $lt: new Date() },
  }).populate("customer", "name");

  for (const invoice of overdueInvoices) {
    invoice.status = "overdue";
    await invoice.save();

    const exists = await Notification.findOne({
      company: companyId,
      type: "overdue_invoice",
      "meta.invoiceId": invoice._id.toString(),
    });

    if (!exists) {
      const notification = await Notification.create({
        company: companyId,
        type: "overdue_invoice",
        title: "Invoice Overdue",
        message: `Invoice ${invoice.invoiceNumber} from ${invoice.customer?.name} is overdue`,
        link: `/invoices/${invoice._id}`,
        meta: {
          invoiceId: invoice._id.toString(),
          invoiceNumber: invoice.invoiceNumber,
        },
      });

      pushToClients(companyId, notification); // ✅
    }
  }

  success(res, { checked: overdueInvoices.length });
});

// GET /
router.get("/", protect, async (req, res) => {
  const notifications = await Notification.find({ company: req.companyId })
    .sort("-createdAt")
    .limit(50);
  const unreadCount = await Notification.countDocuments({
    company: req.companyId,
    read: false,
  });
  success(res, { notifications, unreadCount });
});

// PATCH /:id/read
router.patch("/:id/read", protect, async (req, res) => {
  await Notification.findOneAndUpdate(
    { _id: req.params.id, company: req.companyId },
    { read: true }
  );
  success(res, null, "Marked as read");
});

// PATCH /read-all
router.patch("/read-all", protect, async (req, res) => {
  await Notification.updateMany(
    { company: req.companyId, read: false },
    { read: true }
  );
  success(res, null, "All marked as read");
});

// DELETE /:id
router.delete("/:id", protect, async (req, res) => {
  await Notification.findOneAndDelete({
    _id: req.params.id,
    company: req.companyId,
  });
  success(res, null, "Notification deleted");
});

// DELETE /clear-all
router.delete("/clear-all", protect, async (req, res) => {
  await Notification.deleteMany({ company: req.companyId });
  success(res, null, "All notifications cleared");
});

module.exports = router;