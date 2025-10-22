const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  sku: { type: String },
  unit: { type: String }, // ADDED: The unit for the product (e.g., kg, pcs, L)
  isVisible: { type: Boolean, default: true },
  position: { type: Number, default: 0 } // ADDED: For sorting/ordering
});

module.exports = mongoose.model('Product', productSchema);