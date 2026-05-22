const mongoose = require('mongoose');

const ledgerTransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['credit', 'debit'], required: true }, // credit = You Gave (Udhar), debit = You Got (Mila)
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  date: { type: Date, default: Date.now, index: true },
  
  // Linkages for audit and synchronization
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: false },
  delivery: { type: mongoose.Schema.Types.ObjectId, ref: 'Delivery', required: false },
  adjustmentId: { type: mongoose.Schema.Types.ObjectId, required: false },
  
  // Custom manual ledger entry marker
  isManual: { type: Boolean, default: false },
  paymentMode: { type: String },
  note: { type: String }
}, {
  timestamps: true
});

module.exports = mongoose.model('LedgerTransaction', ledgerTransactionSchema);
