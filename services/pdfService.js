const PDFDocument = require('pdfkit');

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n, currency = 'USD') => `${currency} ${(n || 0).toFixed(2)}`;
const dateStr = (d) => d ? new Date(d).toLocaleDateString('en-US', {
  year: 'numeric', month: 'short', day: 'numeric'
}) : '—';

const hexToRgb = (hex) => {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return [r, g, b];
};

// ── Main Export ───────────────────────────────────────────────────────────────
exports.generateInvoicePDF = (invoice) => new Promise((resolve, reject) => {
  const template = invoice.company?.branding?.template || 'modern';

  switch (template) {
    case 'classic': return generateClassic(invoice, resolve, reject);
    case 'minimal': return generateMinimal(invoice, resolve, reject);
    default:        return generateModern(invoice, resolve, reject);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 1 — MODERN (default, red header)
// ══════════════════════════════════════════════════════════════════════════════
function generateModern(invoice, resolve, reject) {
  const doc  = new PDFDocument({ size: 'A4', margin: 50 });
  const bufs = [];
  doc.on('data', b => bufs.push(b));
  doc.on('end',  () => resolve(Buffer.concat(bufs)));
  doc.on('error', reject);

  const { company, customer, lineItems } = invoice;
  const PRIMARY = company?.branding?.primaryColor || '#DC2626';
  const showLogo  = company?.branding?.showLogo !== false;
  const showBank  = company?.branding?.showBankDetails === true;
  const currency  = invoice.currency || 'USD';

  // ── Header Banner ───────────────────────────────────────────────────────────
  doc.rect(0, 0, 595, 90).fill(PRIMARY);

  // Logo or company initial
  if (showLogo && company?.logo?.url) {
    try {
      doc.image(company.logo.url, 50, 15, { height: 55, fit: [120, 55] });
    } catch {
      doc.fillColor('white').fontSize(28).font('Helvetica-Bold').text('INVOICE', 50, 28);
    }
  } else {
    doc.fillColor('white').fontSize(28).font('Helvetica-Bold').text('INVOICE', 50, 28);
    doc.fontSize(13).font('Helvetica').text(invoice.invoiceNumber, 50, 58);
  }

  // Invoice number top right
  doc.fillColor('white').fontSize(11).font('Helvetica')
    .text(invoice.invoiceNumber, 350, 58, { align: 'right', width: 195 });

  // ── Company Info ────────────────────────────────────────────────────────────
  doc.fillColor('#111').fontSize(11).font('Helvetica-Bold')
    .text(company?.name || '', 350, 100, { align: 'right', width: 195 });
  doc.font('Helvetica').fillColor('#666').fontSize(9)
    .text(company?.email || '', 350, 114, { align: 'right', width: 195 })
    .text(company?.phone || '', 350, 127, { align: 'right', width: 195 });
  if (company?.taxNumber) {
    doc.text(`Tax: ${company.taxNumber}`, 350, 140, { align: 'right', width: 195 });
  }

  // ── Bill To ─────────────────────────────────────────────────────────────────
  doc.fillColor(PRIMARY).fontSize(8).font('Helvetica-Bold')
    .text('BILL TO', 50, 105);
  doc.fillColor('#111').fontSize(12).font('Helvetica-Bold')
    .text(customer?.name || '', 50, 118);
  doc.font('Helvetica').fillColor('#666').fontSize(9)
    .text(customer?.email || '', 50, 133)
    .text(customer?.phone || '', 50, 146);

  // ── Invoice Meta Box ────────────────────────────────────────────────────────
  const metaY = 165;
  doc.rect(50, metaY, 495, 50).fill('#F9FAFB');
  const metaItems = [
    ['Invoice #',   invoice.invoiceNumber],
    ['Issue Date',  dateStr(invoice.issueDate)],
    ['Due Date',    dateStr(invoice.dueDate)],
    ['Status',      (invoice.status || '').toUpperCase()],
  ];
  const colW = 495 / 4;
  metaItems.forEach(([label, value], i) => {
    const x = 55 + i * colW;
    doc.fillColor('#999').fontSize(7).font('Helvetica-Bold')
      .text(label, x, metaY + 8, { width: colW - 5 });
    doc.fillColor('#111').fontSize(9).font('Helvetica-Bold')
      .text(value, x, metaY + 20, { width: colW - 5 });
  });

  // ── Line Items Table ─────────────────────────────────────────────────────────
  let y = 235;
  doc.rect(50, y, 495, 22).fill(PRIMARY);
  doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
    .text('DESCRIPTION', 58,  y + 7)
    .text('QTY',         340, y + 7, { width: 40, align: 'right' })
    .text('RATE',        390, y + 7, { width: 60, align: 'right' })
    .text('AMOUNT',      460, y + 7, { width: 80, align: 'right' });

  y += 24;
  lineItems?.forEach((item, i) => {
    const rowH = 20;
    if (i % 2 === 0) doc.rect(50, y - 3, 495, rowH).fill('#FEF2F2');
    doc.fillColor('#111').font('Helvetica').fontSize(9)
      .text(item.description || '', 58,  y, { width: 270, lineBreak: false })
      .text(String(item.quantity), 340, y, { width: 40,  align: 'right' })
      .text(fmt(item.rate, currency), 390, y, { width: 60, align: 'right' })
      .text(fmt(item.amount, currency), 460, y, { width: 80, align: 'right' });
    y += rowH;
  });

  // ── Totals ──────────────────────────────────────────────────────────────────
  y = drawTotals(doc, invoice, y + 15, PRIMARY, currency);

  // ── Notes & Terms ───────────────────────────────────────────────────────────
  y = drawNotesTerms(doc, invoice, y + 15, PRIMARY);

  // ── Bank Details ────────────────────────────────────────────────────────────
  if (showBank && company?.bankDetails) {
    y = drawBankDetails(doc, company.bankDetails, y + 10, PRIMARY);
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  doc.rect(0, 790, 595, 52).fill('#111');
  doc.fillColor('#aaa').fontSize(8).font('Helvetica')
    .text('Generated by InvoiceFlow', 50, 808,
      { align: 'center', width: 495 });

  doc.end();
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 2 — CLASSIC (left sidebar, professional)
// ══════════════════════════════════════════════════════════════════════════════
function generateClassic(invoice, resolve, reject) {
  const doc  = new PDFDocument({ size: 'A4', margin: 0 });
  const bufs = [];
  doc.on('data', b => bufs.push(b));
  doc.on('end',  () => resolve(Buffer.concat(bufs)));
  doc.on('error', reject);

  const { company, customer, lineItems } = invoice;
  const PRIMARY  = company?.branding?.primaryColor || '#1E3A5F';
  const showLogo = company?.branding?.showLogo !== false;
  const showBank = company?.branding?.showBankDetails === true;
  const currency = invoice.currency || 'USD';

  // ── Left Sidebar ────────────────────────────────────────────────────────────
  doc.rect(0, 0, 180, 842).fill(PRIMARY);

  // Company initial circle
  const [r, g, b] = hexToRgb(PRIMARY);
  doc.circle(90, 80, 45).fill(`rgba(255,255,255,0.15)`);

  if (showLogo && company?.logo?.url) {
    try {
      doc.image(company.logo.url, 45, 45, { fit: [90, 60] });
    } catch {
      doc.fillColor('white').fontSize(26).font('Helvetica-Bold')
        .text((company?.name || 'C')[0].toUpperCase(), 70, 60);
    }
  } else {
    doc.fillColor('white').fontSize(26).font('Helvetica-Bold')
      .text((company?.name || 'C')[0].toUpperCase(), 70, 60);
  }

  // Company details in sidebar
  doc.fillColor('white').fontSize(11).font('Helvetica-Bold')
    .text(company?.name || '', 15, 145, { width: 150, align: 'center' });
  doc.fillColor('rgba(255,255,255,0.7)').fontSize(8).font('Helvetica')
    .text(company?.email || '', 15, 162, { width: 150, align: 'center' })
    .text(company?.phone || '', 15, 175, { width: 150, align: 'center' });
  if (company?.taxNumber) {
    doc.text(`Tax: ${company.taxNumber}`, 15, 188, { width: 150, align: 'center' });
  }

  // Sidebar divider
  doc.moveTo(20, 210).lineTo(160, 210)
    .strokeColor('rgba(255,255,255,0.2)').lineWidth(1).stroke();

  // Invoice meta in sidebar
  doc.fillColor('rgba(255,255,255,0.5)').fontSize(7).font('Helvetica-Bold')
    .text('INVOICE NUMBER', 15, 225, { width: 150, align: 'center' });
  doc.fillColor('white').fontSize(10).font('Helvetica-Bold')
    .text(invoice.invoiceNumber, 15, 237, { width: 150, align: 'center' });

  doc.fillColor('rgba(255,255,255,0.5)').fontSize(7).font('Helvetica-Bold')
    .text('ISSUE DATE', 15, 258, { width: 150, align: 'center' });
  doc.fillColor('white').fontSize(9).font('Helvetica')
    .text(dateStr(invoice.issueDate), 15, 270, { width: 150, align: 'center' });

  doc.fillColor('rgba(255,255,255,0.5)').fontSize(7).font('Helvetica-Bold')
    .text('DUE DATE', 15, 290, { width: 150, align: 'center' });
  doc.fillColor('white').fontSize(9).font('Helvetica')
    .text(dateStr(invoice.dueDate), 15, 302, { width: 150, align: 'center' });

  doc.fillColor('rgba(255,255,255,0.5)').fontSize(7).font('Helvetica-Bold')
    .text('STATUS', 15, 322, { width: 150, align: 'center' });
  doc.fillColor('white').fontSize(9).font('Helvetica-Bold')
    .text((invoice.status || '').toUpperCase(), 15, 334, { width: 150, align: 'center' });

  // Bill To in sidebar
  doc.moveTo(20, 360).lineTo(160, 360)
    .strokeColor('rgba(255,255,255,0.2)').lineWidth(1).stroke();
  doc.fillColor('rgba(255,255,255,0.5)').fontSize(7).font('Helvetica-Bold')
    .text('BILL TO', 15, 372, { width: 150, align: 'center' });
  doc.fillColor('white').fontSize(10).font('Helvetica-Bold')
    .text(customer?.name || '', 15, 385, { width: 150, align: 'center' });
  doc.fillColor('rgba(255,255,255,0.7)').fontSize(8).font('Helvetica')
    .text(customer?.email || '', 15, 400, { width: 150, align: 'center' })
    .text(customer?.phone || '', 15, 413, { width: 150, align: 'center' });

  // ── Main Content ────────────────────────────────────────────────────────────
  const mx = 200; // main x start
  const mw = 375; // main width

  // INVOICE title
  doc.fillColor(PRIMARY).fontSize(32).font('Helvetica-Bold')
    .text('INVOICE', mx, 50, { width: mw });
  doc.fillColor('#999').fontSize(11).font('Helvetica')
    .text(invoice.invoiceNumber, mx, 88, { width: mw });

  // Line items table header
  let y = 140;
  doc.rect(mx, y, mw, 22).fill(PRIMARY);
  doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
    .text('DESCRIPTION', mx + 8, y + 7, { width: 160 })
    .text('QTY',  mx + 175, y + 7, { width: 40, align: 'right' })
    .text('RATE', mx + 220, y + 7, { width: 70, align: 'right' })
    .text('TOTAL', mx + 295, y + 7, { width: 75, align: 'right' });

  y += 24;
  lineItems?.forEach((item, i) => {
    const rowH = 20;
    if (i % 2 === 0) doc.rect(mx, y - 3, mw, rowH).fill('#F8FAFC');
    doc.fillColor('#111').font('Helvetica').fontSize(9)
      .text(item.description || '', mx + 8, y, { width: 160, lineBreak: false })
      .text(String(item.quantity), mx + 175, y, { width: 40, align: 'right' })
      .text(fmt(item.rate, currency), mx + 220, y, { width: 70, align: 'right' })
      .text(fmt(item.amount, currency), mx + 295, y, { width: 75, align: 'right' });
    y += rowH;
  });

  // Totals
  y = drawTotals(doc, invoice, y + 15, PRIMARY, currency, mx, mw);

  // Notes & Terms
  y = drawNotesTerms(doc, invoice, y + 15, PRIMARY, mx, mw);

  // Bank details
  if (showBank && company?.bankDetails) {
    y = drawBankDetails(doc, company.bankDetails, y + 10, PRIMARY, mx, mw);
  }

  // Footer
  doc.rect(180, 800, 415, 42).fill('#F1F5F9');
  doc.fillColor('#aaa').fontSize(8).font('Helvetica')
    .text('Generated by InvoiceFlow', mx, 816,
      { align: 'center', width: mw });

  doc.end();
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 3 — MINIMAL (clean, white, subtle)
// ══════════════════════════════════════════════════════════════════════════════
function generateMinimal(invoice, resolve, reject) {
  const doc  = new PDFDocument({ size: 'A4', margin: 60 });
  const bufs = [];
  doc.on('data', b => bufs.push(b));
  doc.on('end',  () => resolve(Buffer.concat(bufs)));
  doc.on('error', reject);

  const { company, customer, lineItems } = invoice;
  const PRIMARY  = company?.branding?.primaryColor || '#111827';
  const ACCENT   = company?.branding?.primaryColor || '#DC2626';
  const showLogo = company?.branding?.showLogo !== false;
  const showBank = company?.branding?.showBankDetails === true;
  const currency = invoice.currency || 'USD';
  const W = 475; // usable width

  // ── Top bar (thin accent line) ──────────────────────────────────────────────
  doc.rect(60, 0, 475, 4).fill(ACCENT);

  // ── Header ──────────────────────────────────────────────────────────────────
  let y = 40;

  // Logo
  if (showLogo && company?.logo?.url) {
    try {
      doc.image(company.logo.url, 60, y, { height: 40, fit: [100, 40] });
      y += 55;
    } catch {
      doc.fillColor(PRIMARY).fontSize(20).font('Helvetica-Bold')
        .text(company?.name || '', 60, y);
      y += 35;
    }
  } else {
    doc.fillColor(PRIMARY).fontSize(20).font('Helvetica-Bold')
      .text(company?.name || '', 60, y);
    y += 35;
  }

  // INVOICE title + number
  doc.fillColor(PRIMARY).fontSize(30).font('Helvetica-Bold')
    .text('INVOICE', 60, y);
  doc.fillColor('#999').fontSize(12).font('Helvetica')
    .text(invoice.invoiceNumber, 60, y + 36);

  // Company info top right
  doc.fillColor('#666').fontSize(9).font('Helvetica')
    .text(company?.name  || '', 350, y,      { align: 'right', width: 185 })
    .text(company?.email || '', 350, y + 14, { align: 'right', width: 185 })
    .text(company?.phone || '', 350, y + 28, { align: 'right', width: 185 });

  y += 65;

  // Thin divider
  doc.moveTo(60, y).lineTo(535, y).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
  y += 20;

  // ── Bill To + Invoice Details ────────────────────────────────────────────────
  // Left: Bill To
  doc.fillColor('#999').fontSize(8).font('Helvetica-Bold').text('BILL TO', 60, y);
  doc.fillColor(PRIMARY).fontSize(12).font('Helvetica-Bold')
    .text(customer?.name || '', 60, y + 14);
  doc.fillColor('#666').fontSize(9).font('Helvetica')
    .text(customer?.email || '', 60, y + 30)
    .text(customer?.phone || '', 60, y + 44);

  // Right: Invoice details
  const detailItems = [
    ['Invoice #',  invoice.invoiceNumber],
    ['Issue Date', dateStr(invoice.issueDate)],
    ['Due Date',   dateStr(invoice.dueDate)],
    ['Status',     (invoice.status || '').toUpperCase()],
  ];
  detailItems.forEach(([label, value], i) => {
    doc.fillColor('#999').fontSize(8).font('Helvetica')
      .text(label, 350, y + i * 17, { width: 80 });
    doc.fillColor(PRIMARY).fontSize(8).font('Helvetica-Bold')
      .text(value, 440, y + i * 17, { width: 95, align: 'right' });
  });

  y += 75;
  doc.moveTo(60, y).lineTo(535, y).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
  y += 20;

  // ── Line Items ───────────────────────────────────────────────────────────────
  // Table header
  doc.fillColor('#999').fontSize(8).font('Helvetica-Bold')
    .text('DESCRIPTION', 60,  y, { width: 230 })
    .text('QTY',         295, y, { width: 50,  align: 'right' })
    .text('RATE',        350, y, { width: 80,  align: 'right' })
    .text('AMOUNT',      440, y, { width: 95,  align: 'right' });

  y += 14;
  doc.moveTo(60, y).lineTo(535, y).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
  y += 10;

  lineItems?.forEach((item) => {
    doc.fillColor(PRIMARY).font('Helvetica').fontSize(9)
      .text(item.description || '', 60,  y, { width: 230, lineBreak: false })
      .text(String(item.quantity), 295, y, { width: 50,  align: 'right' })
      .text(fmt(item.rate, currency), 350, y, { width: 80, align: 'right' })
      .text(fmt(item.amount, currency), 440, y, { width: 95, align: 'right' });
    y += 20;
    doc.moveTo(60, y - 6).lineTo(535, y - 6)
      .strokeColor('#F3F4F6').lineWidth(0.5).stroke();
  });

  y += 5;

  // Totals
  y = drawTotals(doc, invoice, y + 10, ACCENT, currency, 300, 235);

  // Notes & Terms
  y = drawNotesTerms(doc, invoice, y + 15, ACCENT, 60, W);

  // Bank details
  if (showBank && company?.bankDetails) {
    y = drawBankDetails(doc, company.bankDetails, y + 10, ACCENT, 60, W);
  }

  // Bottom accent line
  doc.rect(60, 800, 475, 3).fill(ACCENT);

  // Footer text
  doc.fillColor('#ccc').fontSize(7).font('Helvetica')
    .text('Generated by InvoiceFlow', 60, 810,
      { align: 'center', width: W });

  doc.end();
}

// ══════════════════════════════════════════════════════════════════════════════
// SHARED HELPERS
// ══════════════════════════════════════════════════════════════════════════════
function drawTotals(doc, invoice, y, PRIMARY, currency, x = 350, w = 195) {
  const rows = [
    ['Subtotal', fmt(invoice.subtotal, currency)],
    invoice.discountAmount > 0 ? ['Discount', `-${fmt(invoice.discountAmount, currency)}`] : null,
    invoice.taxAmount > 0 ? [`Tax (${invoice.taxRate}%)`, fmt(invoice.taxAmount, currency)] : null,
    invoice.shippingCharge > 0 ? ['Shipping', fmt(invoice.shippingCharge, currency)] : null,
  ].filter(Boolean);

  doc.moveTo(x, y).lineTo(x + w, y).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
  y += 10;

  rows.forEach(([label, value]) => {
    doc.fillColor('#666').font('Helvetica').fontSize(9).text(label, x, y, { width: w / 2 });
    doc.fillColor('#111').font('Helvetica-Bold').fontSize(9)
      .text(value, x + w / 2, y, { width: w / 2, align: 'right' });
    y += 16;
  });

  // Total Due box
  doc.rect(x, y + 4, w, 28).fill(PRIMARY);
  doc.fillColor('white').font('Helvetica-Bold').fontSize(10)
    .text('TOTAL DUE', x + 8, y + 12, { width: w / 2 })
    .text(fmt(invoice.total, currency), x + w / 2, y + 12,
      { width: w / 2 - 8, align: 'right' });

  return y + 40;
}

function drawNotesTerms(doc, invoice, y, PRIMARY, x = 50, w = 495) {
  if (!invoice.notes && !invoice.terms) return y;

  const halfW = invoice.notes && invoice.terms ? (w / 2) - 10 : w;
  const x2    = x + halfW + 20;

  if (invoice.notes) {
    doc.fillColor(PRIMARY).fontSize(8).font('Helvetica-Bold').text('NOTES', x, y);
    doc.fillColor('#555').font('Helvetica').fontSize(8)
      .text(invoice.notes, x, y + 12, { width: halfW });
  }
  if (invoice.terms) {
    const tx = invoice.notes ? x2 : x;
    doc.fillColor(PRIMARY).fontSize(8).font('Helvetica-Bold').text('TERMS', tx, y);
    doc.fillColor('#555').font('Helvetica').fontSize(8)
      .text(invoice.terms, tx, y + 12, { width: halfW });
  }

  return y + 50;
}

function drawBankDetails(doc, bank, y, PRIMARY, x = 50, w = 495) {
  if (!bank) return y;

  doc.rect(x, y, w, 8).fill(PRIMARY);
  y += 14;
  doc.fillColor(PRIMARY).fontSize(8).font('Helvetica-Bold')
    .text('BANK DETAILS', x, y);
  y += 12;

  const details = [
    bank.bankName     ? ['Bank', bank.bankName]           : null,
    bank.accountName  ? ['Account Name', bank.accountName] : null,
    bank.accountNumber? ['Account No.', bank.accountNumber]: null,
    bank.ifscSwift    ? ['IFSC/SWIFT', bank.ifscSwift]    : null,
    bank.upiId        ? ['UPI ID', bank.upiId]            : null,
  ].filter(Boolean);

  const colW = w / 3;
  details.forEach(([label, value], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const bx  = x + col * colW;
    const by  = y + row * 28;
    doc.fillColor('#999').fontSize(7).font('Helvetica').text(label, bx, by);
    doc.fillColor('#111').fontSize(8).font('Helvetica-Bold').text(value, bx, by + 10);
  });

  return y + Math.ceil(details.length / 3) * 28 + 10;
}