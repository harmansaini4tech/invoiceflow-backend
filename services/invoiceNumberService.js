const Company = require('../models/Company');

exports.generateInvoiceNumber = async (companyId) => {
  const company = await Company.findByIdAndUpdate(
    companyId,
    { $inc: { 'invoiceSettings.nextNumber': 1 } },
    { new: false }
  );
  const num = String(company.invoiceSettings.nextNumber).padStart(4, '0');
  return `${company.invoiceSettings.prefix || 'INV'}-${num}`;
};