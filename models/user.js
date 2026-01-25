const mongoose = require("mongoose");

const schema = mongoose.Schema({
  username: {
    type: String,
    required: true,
    minlength: 4,
    maxlength: 20,
  },
  passwordHash: {
    type: String,
    required: true,
    select: false,
  },
  role: {
    type: String,
    enum: ["USER", "MODERATOR", "ADMIN"],
    default: "USER",
  },
    bio: {
    type: String,
    maxlength: 200,
    default: "Hot takes enthusiast. Here to share opinions and spark debates."
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  deleted: {
    type: Boolean,
    default: false,
  },

});

schema.index({ username: 1 }, { unique: true });

module.exports = mongoose.model("User", schema);
