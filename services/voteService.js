const { GraphQLError } = require("graphql");
const Vote = require("../models/vote");
const Post = require("../models/post");

const fieldFor = (value) =>
  value === "AGREE" ? "votes.agree" : "votes.disagree";

const addVote = async ({ postId, userId, value }) => {
  const post = await Post.findById(postId);
  if (!post) {
    throw new GraphQLError("post not found", {
      extensions: { code: "NOT_FOUND" },
    });
  }

  const existingVote = await Vote.findOne({
    user: userId,
    post: post.id,
  });

  let inc = {};

  // vote doesn't exist → add vote
  if (!existingVote) {
    const vote = new Vote({
      user: userId,
      post: post.id,
      value,
    });

    await vote.save().catch((error) => {
      throw new GraphQLError("failed to save vote", {
        extensions: { code: "INTERNAL_SERVER_ERROR", error: error.message },
      });
    });

    inc[fieldFor(value)] = 1;
  }

  // same vote value → remove vote
  else if (existingVote.value === value) {
    await existingVote.deleteOne().catch((error) => {
      throw new GraphQLError("failed to delete vote", {
        extensions: { code: "INTERNAL_SERVER_ERROR", error: error.message },
      });
    });

    inc[fieldFor(value)] = -1;
  }

  // opposite vote value → switch vote
  else {
    const prevValue = existingVote.value;
    existingVote.value = value;

    await existingVote.save().catch((error) => {
      throw new GraphQLError("failed to update vote", {
        extensions: { code: "INTERNAL_SERVER_ERROR", error: error.message },
      });
    });

    inc[fieldFor(prevValue)] = -1;
    inc[fieldFor(value)] = 1;
  }

  return Post.findByIdAndUpdate(postId, { $inc: inc }, { new: true }).populate(
    "owner",
  );
};

module.exports = addVote;
