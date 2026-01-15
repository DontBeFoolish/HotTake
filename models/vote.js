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
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

schema.index({ post: 1 });
schema.index({ user: 1 });
schema.index({ user: 1, post: 1 }, { unique: true });

module.exports = mongoose.model("Vote", schema);
