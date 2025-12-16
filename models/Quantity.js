const mongoose = require('mongoose');

const quantitySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    limit: {
        type: Number,
        required: true,
        min: 0
    }
});

module.exports = mongoose.model('Quantity', quantitySchema);
