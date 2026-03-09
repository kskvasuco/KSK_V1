const mongoose = require('mongoose');

// This schema will store the sequence number for the custom order IDs.
const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // A unique name for the counter, e.g., 'orderId'
  seq: { type: Number, default: 0 },   // The current sequence number
  lastReset: { type: Date, default: Date.now } // Tracks the start of the current counting period
});

// Add indexes for performance optimization
// Note: _id is automatically indexed by MongoDB, so we don't need to add it manually
CounterSchema.index({ lastReset: 1 }); // For reset queries

module.exports = mongoose.model('Counter', CounterSchema);