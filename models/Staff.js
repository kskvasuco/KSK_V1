const mongoose = require('mongoose');

const StaffSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Add indexes for performance optimization
// Note: username is already indexed automatically due to unique constraint
StaffSchema.index({ createdAt: -1 }); // For staff management queries

module.exports = mongoose.model('Staff', StaffSchema);