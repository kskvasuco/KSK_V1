const mongoose = require('mongoose');

const ledgerTransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['credit', 'debit'], required: true }, // credit = You Gave (Udhar), debit = You Got (Mila)
  amount: { type: Number, required: true },
  description: { type: String, required: false },
  date: { type: Date, default: Date.now, index: true },

  // Linkages for audit and synchronization
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: false },
  delivery: { type: mongoose.Schema.Types.ObjectId, ref: 'Delivery', required: false },
  adjustmentId: { type: mongoose.Schema.Types.ObjectId, required: false },

  // Custom manual ledger entry marker
  isManual: { type: Boolean, default: false },
  paymentMode: { type: String },
  note: { type: String },

  // Product line items attached to a "You Got" (debit/Cr) transaction
  productItems: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name:  { type: String },
    sku:   { type: String },
    qty:   { type: Number, default: 1 },
    unitPrice: { type: Number }
  }],

  // Pre-computed SKU display string e.g. "SKU-001 × 2, SKU-002 × 1"
  skuLine: { type: String },

  isClosed: { type: Boolean, default: false },

  deleteRequest: {
    isRequested: { type: Boolean, default: false },
    requestedBy: { type: String },
    requestedAt: { type: Date },
    status: { type: String, enum: ['active', 'pending', 'rejected'], default: 'active' }
  },

  isDeleted: { type: Boolean, default: false, index: true }

}, {
  timestamps: true
});

module.exports = mongoose.model('LedgerTransaction', ledgerTransactionSchema);
