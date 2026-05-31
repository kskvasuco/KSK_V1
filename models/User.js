const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  mobile: { type: String, required: true, unique: true },
  name: { type: String },
  email: { type: String },
  altMobile: { type: String },
  district: { type: String },
  taluk: { type: String },
  // place: { type: String }, // REMOVED
  // landmark: { type: String }, // REMOVED
  address: { type: String }, // ADDED
  pincode: { type: String },
  isRateRequestEnabled: { type: Boolean, default: true },
  isBlocked: { type: Boolean, default: false },
  netBalance: { type: Number, default: 0 },
  totalYouGave: { type: Number, default: 0 },
  totalYouGot: { type: Number, default: 0 },
  isAddedToLedger: { type: Boolean, default: false },
  ledgerType: { type: String, enum: ['Customer', 'Supplier'], default: 'Customer' },
  openingBalance: { type: Number, default: 0 },
  openingBalanceType: { type: String, enum: ['debit', 'credit'], default: 'debit' },
  isDeleted: { type: Boolean, default: false, index: true }
}, {
  // This option automatically adds `createdAt` and `updatedAt` fields.
  timestamps: true
});

// Add indexes for performance optimization
// Note: mobile is already indexed automatically due to unique constraint
userSchema.index({ district: 1, taluk: 1 }); // For location-based queries
userSchema.index({ isAddedToLedger: 1, ledgerType: 1 }); // For ledger queries
userSchema.index({ createdAt: -1 }); // For sorting users by creation date

module.exports = mongoose.model('User', userSchema);