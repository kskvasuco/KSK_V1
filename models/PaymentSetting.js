const mongoose = require('mongoose');

const paymentSettingSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., "GPay", "Paytm", "HDFC Bank"
  qrCode: { type: String, required: false }, // Made optional for bank-only details
  bankName: { type: String }, // New field
  accountName: { type: String }, // New field
  accountNumber: { type: String }, // New field
  ifsc: { type: String }, // New field
  type: { 
    type: String, 
    enum: ['primary', 'bank'], 
    default: 'bank' 
  }, // 'primary' for GPay/Paytm, 'bank' for others
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

paymentSettingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('PaymentSetting', paymentSettingSchema);
