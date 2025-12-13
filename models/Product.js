const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  sku: { type: String },
  unit: { type: String }, // ADDED: The unit for the product (e.g., kg, pcs, L)
  isVisible: { type: Boolean, default: true },
  displayOrder: { type: Number, default: 0 }, // ADDED: For custom product ordering
  imageData: { type: String } // ADDED: Base64 encoded product image
});

// Add indexes for performance optimization
productSchema.index({ isVisible: 1 }); // For filtering visible products
productSchema.index({ sku: 1 }); // For product lookups by SKU
productSchema.index({ isVisible: 1, name: 1 }); // For sorted product lists

module.exports = mongoose.model('Product', productSchema);
