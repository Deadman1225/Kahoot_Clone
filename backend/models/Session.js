const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    roomPin: { 
        type: String, 
        required: true,
        unique: true 
    },
    hostSocketId: { 
        type: String, 
        required: true 
    }
});

module.exports = mongoose.model('Session', sessionSchema);