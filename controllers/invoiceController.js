const Invoice = require("../models/Invoice");
const Customer = require("../models/Customer");
const Subscription = require("../models/Subscription");
const ApiError = require("../utils/ApiError");
const { success, paginated } = require("../utils/ApiResponse");
const { generateInvoiceNumber } = require("../services/invoiceNumberService");
const { generateInvoicePDF } = require("../services/pdfService");
const { sendInvoiceEmail } = require("../services/emailService");
const { v4: uuidv4 } = require("uuid");
const { createNotification } = require("../services/notificationService");

// GET /api/v1/invoices
exports.getInvoices = async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    search,
    customerId,
    startDate,
    endDate,
    sort = "-createdAt",
  } = req.query;
  const query = { company: req.companyId };

  if (status) query.status = status;
  if (customerId) query.customer = customerId;
  if (startDate || endDate) {
    query.issueDate = {};
    if (startDate) query.issueDate.$gte = new Date(startDate);
    if (endDate) query.issueDate.$lte = new Date(endDate);
  }
  if (search) query.invoiceNumber = { $regex: search, $options: "i" };

  const total = await Invoice.countDocuments(query);
  const invoices = await Invoice.find(query)
    .populate("customer", "name email")
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(+limit)
    .lean();

  paginated(res, invoices, {
    page: +page,
    limit: +limit,
    total,
    pages: Math.ceil(total / limit),
  });
};

// POST /api/v1/invoices
exports.createInvoice = async (req, res) => {
  const { lineItems, customer: customerId, ...rest } = req.body;

  // Verify customer belongs to this company
  const customer = await Customer.findOne({
    _id: customerId,
    company: req.companyId,
  });
  if (!customer) throw new ApiError("Customer not found", 404);

  // Calculate totals
  const subtotal = lineItems.reduce((s, item) => {
    const itemTotal = item.quantity * item.rate;
    const discount = itemTotal * (item.discount / 100);
    item.amount = itemTotal - discount;
    return s + item.amount;
  }, 0);

  const discountAmount =
    rest.discountType === "percent"
      ? (subtotal * (rest.discountValue || 0)) / 100
      : rest.discountValue || 0;

  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * ((rest.taxRate || 0) / 100);
  const total = taxableAmount + taxAmount + (rest.shippingCharge || 0);

  const invoiceNumber = await generateInvoiceNumber(req.companyId);

  const invoice = await Invoice.create({
    ...rest,
    company: req.companyId,
    customer: customerId,
    lineItems,
    invoiceNumber,
    subtotal,
    discountAmount,
    taxAmount,
    total,
    balanceDue: total,
    publicToken: uuidv4(),
  });

  // Increment subscription counter
  await Subscription.findOneAndUpdate(
    { company: req.companyId },
    { $inc: { invoiceCount: 1 } }
  );

  // Update customer stats
  await Customer.findByIdAndUpdate(customerId, {
    $inc: { totalInvoiced: total, totalOutstanding: total },
  });

  success(res, invoice, "Invoice created", 201);
};

// GET /api/v1/invoices/:id
exports.getInvoice = async (req, res) => {
  const invoice = await Invoice.findOne({
    _id: req.params.id,
    company: req.companyId,
  })
    .populate("customer")
    .populate({
      path: "company",
      select: "name email address logo branding bankDetails invoiceSettings",
    });
  if (!invoice) throw new ApiError("Invoice not found", 404);
  success(res, invoice);
};

// PUT /api/v1/invoices/:id
exports.updateInvoice = async (req, res) => {
  const invoice = await Invoice.findOne({
    _id: req.params.id,
    company: req.companyId,
  });
  if (!invoice) throw new ApiError("Invoice not found", 404);
  if (invoice.status === "paid")
    throw new ApiError("Cannot edit a paid invoice", 400);

  const updated = await Invoice.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).populate("customer");
  success(res, updated, "Invoice updated");
};

// DELETE /api/v1/invoices/:id
exports.deleteInvoice = async (req, res) => {
  const invoice = await Invoice.findOne({
    _id: req.params.id,
    company: req.companyId,
  });
  if (!invoice) throw new ApiError("Invoice not found", 404);
  await invoice.deleteOne();
  await Subscription.findOneAndUpdate(
    { company: req.companyId },
    { $inc: { invoiceCount: -1 } }
  );
  success(res, null, "Invoice deleted");
};

// POST /api/v1/invoices/:id/send
exports.sendInvoice = async (req, res) => {
  const invoice = await Invoice.findOne({
    _id: req.params.id,
    company: req.companyId,
  })
    .populate("customer")
    .populate("company");
  if (!invoice) throw new ApiError("Invoice not found", 404);

  await sendInvoiceEmail(invoice);
  invoice.status = invoice.status === "draft" ? "sent" : invoice.status;
  invoice.emailSentAt = new Date();
  await invoice.save();

  // ✅ Only invoice_sent notification here
  // ✅ Send response first — don't delay for notification
  success(res, invoice, "Invoice sent successfully");

  await createNotification({
    company: invoice.company._id,
    type: "invoice_sent",
    title: "Invoice Sent",
    message: `Invoice ${invoice.invoiceNumber} sent to ${invoice.customer?.name}`,
    link: `/invoices/${invoice._id}`,
    meta: { invoiceNumber: invoice.invoiceNumber },
  });
};

// GET /api/v1/invoices/:id/pdf
exports.downloadPDF = async (req, res) => {
  const invoice = await Invoice.findOne({
    _id: req.params.id,
    company: req.companyId,
  })
    .populate("customer")
    .populate("company");
  if (!invoice) throw new ApiError("Invoice not found", 404);

  const pdfBuffer = await generateInvoicePDF(invoice);
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename=Invoice-${invoice.invoiceNumber}.pdf`,
    "Content-Length": pdfBuffer.length,
  });
  res.send(pdfBuffer);
};

// POST /api/v1/invoices/:id/duplicate
exports.duplicateInvoice = async (req, res) => {
  const original = await Invoice.findOne({
    _id: req.params.id,
    company: req.companyId,
  }).lean();
  if (!original) throw new ApiError("Invoice not found", 404);

  const {
    _id,
    invoiceNumber,
    publicToken,
    emailSentAt,
    paidAt,
    viewedAt,
    createdAt,
    updatedAt,
    ...rest
  } = original;
  const newNumber = await generateInvoiceNumber(req.companyId);
  const duplicate = await Invoice.create({
    ...rest,
    invoiceNumber: newNumber,
    status: "draft",
    publicToken: uuidv4(),
    issueDate: new Date(),
  });
  success(res, duplicate, "Invoice duplicated", 201);
};

// PATCH /api/v1/invoices/:id/mark-paid
exports.markPaid = async (req, res) => {
  const invoice = await Invoice.findOne({
    _id: req.params.id,
    company: req.companyId,
  });
  if (!invoice) throw new ApiError("Invoice not found", 404);

  invoice.status = "paid";
  invoice.amountPaid = invoice.total;
  invoice.balanceDue = 0;
  invoice.paidAt = new Date();
  await invoice.save();

  await Customer.findByIdAndUpdate(invoice.customer, {
    $inc: { totalPaid: invoice.total, totalOutstanding: -invoice.total },
  });

  // ✅ payment_received notification here
  await createNotification({
    company: invoice.company, // ✅ not populated here so direct _id
    type: "payment_received",
    title: "Payment Received",
    message: `Invoice ${invoice.invoiceNumber} marked as paid — ${
      invoice.currency
    } ${invoice.total?.toFixed(2)}`,
    link: `/invoices/${invoice._id}`,
    meta: { invoiceNumber: invoice.invoiceNumber, amount: invoice.total },
  });

  success(res, invoice, "Invoice marked as paid");
};
