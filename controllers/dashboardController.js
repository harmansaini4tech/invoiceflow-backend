const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const Expense = require('../models/Expense');
const { success } = require('../utils/ApiResponse');
const moment = require('moment');

exports.getStats = async (req, res) => {
  const companyId = req.companyId;
  const now = moment();
  const startOfMonth = now.clone().startOf('month').toDate();
  const startOfYear = now.clone().startOf('year').toDate();

  const [
    totalInvoices, paidInvoices, overdueInvoices, draftInvoices,
    totalRevenue, monthlyRevenue, totalCustomers, recentInvoices,
    revenueByMonth, topCustomers,
  ] = await Promise.all([
    Invoice.countDocuments({ company: companyId }),
    Invoice.countDocuments({ company: companyId, status: 'paid' }),
    Invoice.countDocuments({ company: companyId, status: 'overdue' }),
    Invoice.countDocuments({ company: companyId, status: 'draft' }),
    Invoice.aggregate([
      { $match: { company: companyId, status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]),
    Invoice.aggregate([
      { $match: { company: companyId, status: 'paid', paidAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]),
    Customer.countDocuments({ company: companyId }),
    Invoice.find({ company: companyId }).sort('-createdAt').limit(5).populate('customer', 'name'),
    Invoice.aggregate([
      { $match: { company: companyId, issueDate: { $gte: startOfYear } } },
      { $group: {
        _id: { month: { $month: '$issueDate' } },
        total: { $sum: '$total' },
        paid: { $sum: { $cond: [{ $eq: ['$status','paid'] }, '$total', 0] } },
      }},
      { $sort: { '_id.month': 1 } },
    ]),
    Customer.find({ company: companyId }).sort('-totalInvoiced').limit(5).select('name totalInvoiced totalPaid'),
  ]);

  // Mark overdue invoices automatically
  await Invoice.updateMany(
    { company: companyId, status: 'sent', dueDate: { $lt: new Date() } },
    { $set: { status: 'overdue' } }
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