const mongoose = require('mongoose');

const ledgerCloseBalanceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  transactionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LedgerTransaction' }],
  closedCount: { type: Number, default: 0 },
  openingBalanceBefore: { type: Number, required: true },
  openingBalanceTypeBefore: { type: String, enum: ['debit', 'credit'], required: true },
  openingBalanceAfter: { type: Number, required: true },
  openingBalanceTypeAfter: { type: String, enum: ['debit', 'credit'], required: true },
  status: { type: String, enum: ['active', 'reverted', 'deleted'], default: 'active' },
  createdBy: { type: String, default: 'system' },
  revertedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('LedgerCloseBalance', ledgerCloseBalanceSchema);

