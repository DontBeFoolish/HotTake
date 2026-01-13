const mongoose = require("mongoose");

const schema = mongoose.Schema({
  title: {
    type: String,
    required: true,
    minlength: 6,
    maxlength: 150,
  },
  body: {
    type: String,
    required: true,
    minlength: 6,
    maxlength: 1000,
  },
  votes: {
    agree: {
      type: Number,
      default: 0,
    },
    disagree: {
      type: Number,
      default: 0,
    },
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Post", schema);
