const mongoose = require('mongoose');

const deliveryAgentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: String },
  description: { type: String },
  address: { type: String }
}, {
  timestamps: true
});

// Index name and mobile for queries
deliveryAgentSchema.index({ name: 1, mobile: 1 });

module.exports = mongoose.model('DeliveryAgent', deliveryAgentSchema);
