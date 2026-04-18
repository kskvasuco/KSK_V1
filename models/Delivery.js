const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
  // Link to the main order document
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true
  },
  // Link to the specific product being delivered (may be null for custom items)
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: false
  },
  // Link to the specific item record in order.items
  orderItemId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  // Item name (required for custom products, good for history)
  name: {
    type: String,
    required: true
  },
  isCustom: {
    type: Boolean,
    default: false
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
    mobile: { type: String },
    description: { type: String }, // Added to match Order
    address: { type: String }     // Added to match Order
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
  // The amount expected to be collected for this batch
  expectedAmount: {
    type: Number,
    default: 0
  },
  // Rent or charges paid to the agent for this specific delivery
  agentCharge: {
    type: Number,
    default: 0
  },
  // Payment mode if received
  paymentMode: {
    type: String,
    enum: ['Cash', 'GPay', 'PhonePe', 'Bank Transfer', 'Other', null],
    default: null
  },
  // ID for the dispatch batch (e.g., D/MAR/W3/00001)
  dispatchId: {
    type: String,
    index: true
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
