const mongoose = require("mongoose");

const schema = mongoose.Schema({
  username: {
    type: String,
    required: true,
    minlength: 4,
    maxlength: 24,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

schema.index({ username: 1 }, { unique: true });

module.exports = mongoose.model("User", schema);
