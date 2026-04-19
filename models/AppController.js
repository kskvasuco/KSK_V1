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
