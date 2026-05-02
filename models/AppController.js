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
    profilePassword: {
        type: String,
        default: '' // Empty string means it will fall back to env or adminpass globally
    },

    adminLoginPassword: {
        type: String,
        default: '' // Database-backed password override
    },
    adminEmail: {
        type: String,
        default: '' // Email for OTP resets
    },
    adminUsername: {
        type: String,
        default: '' // Database-backed username override
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
