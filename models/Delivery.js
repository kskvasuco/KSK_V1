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
  // Timestamp for when this delivery was recorded
  deliveryDate: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true 
});

module.exports = mongoose.model('Delivery', deliverySchema);
