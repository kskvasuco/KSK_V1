const mongoose = require('mongoose');

// Sub-schema for charges, discounts, etc.
const adjustmentSchema = new mongoose.Schema({
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  type: {
    type: String,
    required: true,
    enum: ['charge', 'discount', 'advance']
  },
  isLocked: { type: Boolean, default: false } // <<< ADDED
});

// This schema represents a single line item within an order
// It now tracks ordered vs. delivered quantities.
const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  sku: { type: String },
  description: { type: String },
  unit: { type: String },
  quantityOrdered: { type: Number, required: true },
  quantityDelivered: { type: Number, required: true, default: 0 }
});


const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // An order now contains multiple items in an array
  items: [orderItemSchema],

  status: {
    type: String,
    // Added 'Partially Delivered' status
    enum: ['Pending', 'Confirmed', 'Paused', 'Delivered', 'Cancelled', 'Rate Requested', 'Rate Approved', 'Hold', 'Dispatch', 'Partially Delivered'],
    default: 'Pending'
  },
  isEditable: { type: Boolean, default: true },
  
  customOrderId: { type: String, index: true },
  pauseReason: { type: String },

  adjustments: [adjustmentSchema],

  confirmedAt: { type: Date },
  deliveredAt: { type: Date }, // This will now mark the final delivery date
  cancelledAt: { type: Date },

  // This agent is the one currently assigned to the *next* delivery run
  deliveryAgent: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    name: { type: String },
    mobile: { type: String },
    description: { type: String },
    address: { type: String } // <<< ADDED
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

module.exports = mongoose.model('Order', orderSchema);
