const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({

   name: {
      type: String,
      required: true
   },

   MobNo: {
      type: String,
      required: true,
      unique: true
   },

   password: {
      type: String,
      required: true
   }

});



module.exports = {UserSchema};