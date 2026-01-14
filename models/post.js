const mongoose = require("mongoose");

const schema = mongoose.Schema({
  content: {
    type: String,
    required: true,
    minlength: 10,
    maxlength: 200,
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
