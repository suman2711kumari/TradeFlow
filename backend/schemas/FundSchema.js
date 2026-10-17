const mongoose = require("mongoose");
const { Schema } = mongoose;

const FundsSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true
    },

    openingBalance: {
        type: Number,
        default: 10000
    },

    availableCash: {
        type: Number,
        default: 10000
    },

    usedMargin: {
        type: Number,
        default: 0
    }
});


module.exports = { FundsSchema };
