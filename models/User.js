const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  mobile: { type: String, required: true, unique: true },
  name: { type: String },
  email: { type: String },
  altMobile: { type: String },
  district: { type: String },
  taluk: { type: String },
  // place: { type: String }, // REMOVED
  // landmark: { type: String }, // REMOVED
  address: { type: String }, // ADDED
  pincode: { type: String }
}, {
  // This option automatically adds `createdAt` and `updatedAt` fields.
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);