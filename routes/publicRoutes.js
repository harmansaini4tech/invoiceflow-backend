const router = require("express").Router();
const Invoice = require("../models/Invoice");
const Company = require("../models/Company");
const Customer = require("../models/Customer");
const { success } = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");

// GET /api/v1/public/invoice/:token
router.get("/invoice/:token", async (req, res) => {
  const invoice = await Invoice.findOne({ publicToken: req.params.token })
    .populate("customer", "name email phone address")
    .populate("company", "name email phone address logo");

  if (!invoice) throw new ApiError("Invoice not found or link expired", 404);

  // Don't expose sensitive fields
  const safe = {
    _id: invoice._id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    lineItems: invoice.lineItems,
    subtotal: invoice.subtotal,
    taxRate: invoice.taxRate,
    taxAmount: invoice.taxAmount,
    discountAmount: invoice.discountAmount,
    shippingCharge: invoice.shippingCharge,
    total: invoice.total,
    balanceDue: invoice.balanceDue,
    notes: invoice.notes,
    terms: invoice.terms,
    customer: invoice.customer,
    company: invoice.company,
    publicToken: invoice.publicToken,
  };

  success(res, safe);
});

// GET /api/v1/public/invoice/:token/pdf
router.get("/invoice/:token/pdf", async (req, res) => {
  const invoice = await Invoice.findOne({ publicToken: req.params.token })
    .populate("customer")
    .populate("company");

  if (!invoice) throw new ApiError("Invoice not found", 404);

  const { generateInvoicePDF } = require("../services/pdfService");
  const pdfBuffer = await generateInvoicePDF(invoice);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="Invoice-${invoice.invoiceNumber}.pdf"`
  );
  res.send(pdfBuffer);
});

module.exports = router;
