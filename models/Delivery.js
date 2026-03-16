const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
  // Link to the main order document
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true
  },
  // Link to the specific product being delivered
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  // Custom Order ID for easier reference (e.g., OC12345)
  customOrderId: {
    type: String,
    required: true,
    index: true
  },
  // Details of the agent who made this specific delivery
  deliveryAgent: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    name: { type: String, required: true },
    mobile: { type: String }
  },
  // The quantity delivered in this specific event
  quantityDelivered: {
    type: Number,
    required: true
  },
  // Whether this delivery has been confirmed by admin (e.g., payment verified)
  isConfirmed: {
    type: Boolean,
    default: false
  },
  // Any amount collected by the agent for this specific batch
  receivedAmount: {
    type: Number,
    default: 0
  },
  // Rent or charges paid to the agent for this specific delivery
  agentCharge: {
    type: Number,
    default: 0
  },
  // Timestamp for when this delivery was recorded
  deliveryDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Add indexes for performance when fetching delivery history
deliverySchema.index({ order: 1, deliveryDate: -1 }); // By order ObjectId
deliverySchema.index({ customOrderId: 1, deliveryDate: -1 }); // By custom order ID (e.g., "JA0000123")

module.exports = mongoose.model('Delivery', deliverySchema);
