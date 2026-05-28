const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    nickname: { 
        type: String, 
        required: true 
    },
    socketId: { 
        type: String, 
        required: true 
    },
    roomPin: { 
        type: String, 
        required: true 
    },
    score: { 
        type: Number, 
        default: 0 
    }
});

module.exports = mongoose.model('User', userSchema);