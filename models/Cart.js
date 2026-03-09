const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true },
  unit: { type: String },
  description: { type: String }
});

const cartSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: [cartItemSchema],
  updatedAt: { type: Date, default: Date.now }
});

// Add indexes for performance optimization
// Note: user is already indexed automatically due to unique constraint
cartSchema.index({ updatedAt: 1 }); // For cleanup/maintenance queries
cartSchema.index({ user: 1, updatedAt: -1 }); // Compound index for efficient retrieval

module.exports = mongoose.model('Cart', cartSchema);