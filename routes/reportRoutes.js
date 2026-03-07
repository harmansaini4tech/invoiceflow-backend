const router = require("express").Router();
const Invoice = require("../models/Invoice");
const Expense = require("../models/Expense");
const { protect } = require("../middlewares/authMiddleware");
const { success } = require("../utils/ApiResponse");

// GET /api/v1/reports/summary?from=2024-01-01&to=2024-12-31
router.get("/summary", protect, async (req, res) => {
  const companyId = req.companyId;
  const { from, to, status } = req.query;

  const dateFilter = {};
  if (from) dateFilter.$gte = new Date(from);
  if (to) dateFilter.$lte = new Date(new Date(to).setHours(23, 59, 59));

  const matchInvoice = { company: companyId };
  const matchExpense = { company: companyId };
  if (from || to) {
    matchInvoice.issueDate = dateFilter;
    matchExpense.date = dateFilter;
  }

  if (status && status !== "all") matchInvoice.status = status;

  const [
    invoiceSummary,
    statusBreakdown,
    revenueByMonth,
    topCustomers,
    expenseSummary,
    expenseByCategory,
  ] = await Promise.all([
    // Overall invoice totals
    Invoice.aggregate([
      { $match: matchInvoice },
      {
        $group: {
          _id: null,
          totalInvoiced: { $sum: "$total" },
          totalPaid: {
            $sum: { $cond: [{ $eq: ["$status", "paid"] }, "$total", 0] },
          },
          totalUnpaid: {
            $sum: { $cond: [{ $ne: ["$status", "paid"] }, "$total", 0] },
          },
          totalOverdue: {
            $sum: { $cond: [{ $eq: ["$status", "overdue"] }, "$total", 0] },
          },
          count: { $sum: 1 },
        },
      },
    ]),

    // Count by status
    Invoice.aggregate([
      { $match: matchInvoice },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          total: { $sum: "$total" },
        },
      },
      { $sort: { total: -1 } },
    ]),

    // Revenue by month
    Invoice.aggregate([
      { $match: matchInvoice },
      {
        $group: {
          _id: {
            year: { $year: "$issueDate" },
            month: { $month: "$issueDate" },
          },
          revenue: { $sum: "$total" },
          paid: {
            $sum: { $cond: [{ $eq: ["$status", "paid"] }, "$total", 0] },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),

    // Top customers
    Invoice.aggregate([
      { $match: matchInvoice },
      {
        $group: {
          _id: "$customer",
          total: { $sum: "$total" },
          paid: {
            $sum: { $cond: [{ $eq: ["$status", "paid"] }, "$total", 0] },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "customers",
          localField: "_id",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: "$customer" },
      {
        $project: {
          name: "$customer.name",
          email: "$customer.email",
          total: 1,
          paid: 1,
          count: 1,
        },
      },
    ]),

    // Expense totals
    Expense.aggregate([
      { $match: matchExpense },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]).catch(() => []),

    // Expense by category
    Expense.aggregate([
      { $match: matchExpense },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]).catch(() => []),
  ]);

  success(res, {
    invoiceSummary: invoiceSummary[0] || {
      totalInvoiced: 0,
      totalPaid: 0,
      totalUnpaid: 0,
      totalOverdue: 0,
      count: 0,
    },
    statusBreakdown,
    revenueByMonth,
    topCustomers,
    expenseSummary: expenseSummary[0] || { total: 0, count: 0 },
    expenseByCategory,
  });
});

// GET /api/v1/reports/export/invoices?from=&to=&status=
router.get("/export/invoices", protect, async (req, res) => {
  const companyId = req.companyId;
  const { from, to, status } = req.query;

  const match = { company: companyId };
  if (from || to) {
    match.issueDate = {};
    if (from) match.issueDate.$gte = new Date(from);
    if (to) match.issueDate.$lte = new Date(new Date(to).setHours(23, 59, 59));
  }
  if (status && status !== "all") match.status = status;

  const invoices = await Invoice.find(match)
    .populate("customer", "name email phone")
    .sort("-issueDate");

  const rows = [
    [
      "Invoice #",
      "Customer",
      "Email",
      "Issue Date",
      "Due Date",
      "Status",
      "Subtotal",
      "Tax",
      "Discount",
      "Shipping",
      "Total",
      "Currency",
    ],
    ...invoices.map((inv) => [
      inv.invoiceNumber,
      inv.customer?.name || "",
      inv.customer?.email || "",
      inv.issueDate ? new Date(inv.issueDate).toISOString().split("T")[0] : "",
      inv.dueDate ? new Date(inv.dueDate).toISOString().split("T")[0] : "",
      inv.status,
      (inv.subtotal || 0).toFixed(2),
      (inv.taxAmount || 0).toFixed(2),
      (inv.discountAmount || 0).toFixed(2),
      (inv.shippingCharge || 0).toFixed(2),
      (inv.total || 0).toFixed(2),
      inv.currency || "USD",
    ]),
  ];

  const csv = rows
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="invoices-report.csv"'
  );
  res.send(csv);
});

// GET /api/v1/reports/export/expenses?from=&to=
router.get("/export/expenses", protect, async (req, res) => {
  const companyId = req.companyId;
  const { from, to } = req.query;

  const match = { company: companyId };
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to) match.date.$lte = new Date(new Date(to).setHours(23, 59, 59));
  }

  let expenses = [];
  try {
    expenses = await Expense.find(match).sort("-date");
  } catch {
    expenses = [];
  }

  const rows = [
    [
      "Date",
      "Category",
      "Description",
      "Vendor",
      "Amount",
      "Currency",
      "Notes",
    ],
    ...expenses.map((e) => [
      e.date ? new Date(e.date).toISOString().split("T")[0] : "",
      e.category || "",
      e.description || "",
      e.vendor || "",
      (e.amount || 0).toFixed(2),
      e.currency || "USD",
      e.notes || "",
    ]),
  ];

  const csv = rows
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="expenses-report.csv"'
  );
  res.send(csv);
});

module.exports = router;
