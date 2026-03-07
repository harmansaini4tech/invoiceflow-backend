const Invoice = require("../models/Invoice");
const Customer = require("../models/Customer");
const { success } = require("../utils/ApiResponse");
const moment = require("moment");

exports.getStats = async (req, res) => {
  const companyId = req.companyId;
  const now = moment();
  const startOfMonth = now.clone().startOf("month").toDate();
  const startOfYear = now.clone().startOf("year").toDate();

  const [
    totalInvoices,
    paidInvoices,
    overdueInvoices,
    draftInvoices,
    totalRevenue,
    monthlyRevenue,
    totalCustomers,
    recentInvoices,
    revenueByMonth,
    topCustomers,
  ] = await Promise.all([
    Invoice.countDocuments({ company: companyId }),
    Invoice.countDocuments({ company: companyId, status: "paid" }),
    Invoice.countDocuments({ company: companyId, status: "overdue" }),
    Invoice.countDocuments({ company: companyId, status: "draft" }),

    Invoice.aggregate([
      { $match: { company: companyId, status: "paid" } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    Invoice.aggregate([
      {
        $match: {
          company: companyId,
          status: "paid",
          paidAt: { $gte: startOfMonth },
        },
      },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),

    Customer.countDocuments({ company: companyId }),
    Invoice.find({ company: companyId })
      .sort("-createdAt")
      .limit(5)
      .populate("customer", "name"),

    Invoice.aggregate([
      { $match: { company: companyId, issueDate: { $gte: startOfYear } } },
      {
        $group: {
          _id: { month: { $month: "$issueDate" } },
          total: { $sum: "$total" },
          paid: {
            $sum: { $cond: [{ $eq: ["$status", "paid"] }, "$total", 0] },
          },
        },
      },
      { $sort: { "_id.month": 1 } },
    ]),

    // ── Top Customers — live from invoices ──────────────────────────
    Invoice.aggregate([
      { $match: { company: companyId } },
      {
        $group: {
          _id: "$customer",
          total: { $sum: "$total" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "customers",
          localField: "_id",
          foreignField: "_id",
          as: "customerData",
        },
      },
      { $unwind: "$customerData" },
      {
        $project: {
          _id: "$customerData._id",
          name: "$customerData.name",
          total: 1,
          count: 1,
        },
      },
    ]),
  ]);

  // ── Auto-mark overdue ───────────────────────────────────────────────
  await Invoice.updateMany(
    { company: companyId, status: "sent", dueDate: { $lt: new Date() } },
    { $set: { status: "overdue" } }
  );

  success(res, {
    stats: {
      totalInvoices,
      paidInvoices,
      overdueInvoices,
      draftInvoices,
      pendingInvoices: totalInvoices - paidInvoices,
      totalRevenue: totalRevenue[0]?.total || 0,
      monthlyRevenue: monthlyRevenue[0]?.total || 0,
      totalCustomers,
    },
    recentInvoices,
    revenueByMonth,
    topCustomers,
  });
};
