const mongoose = require("mongoose");

const schema = mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Post",
    required: true,
  },
  value: {
    type: String,
    enum: ["AGREE", "DISAGREE"],
    required: true,
  },
});

schema.index({ user: 1, post: 1 }, { unique: true });

module.exports = mongoose.model("Vote", schema);
