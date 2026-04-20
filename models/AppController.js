const mongoose = require('mongoose');

const appControllerSchema = new mongoose.Schema({
    isChargesEnabledAdmin: {
        type: Boolean,
        default: true
    },
    isChargesEnabledStaff: {
        type: Boolean,
        default: true
    },
    adminActionPassword: {
        type: String,
        default: '' // Empty string means it will fall back to env or adminpass globally
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Pre-save hook to update the updatedAt field
appControllerSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('AppController', appControllerSchema);
