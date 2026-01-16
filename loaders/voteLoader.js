const DataLoader = require("dataloader");
const Vote = require("../models/vote");

const createVoteLoader = () => {
  return new DataLoader(async (keys) => {
    const postIds = keys.map((k) => k.postId);
    const userId = keys[0]?.userId;

    const votes = await Vote.find({ post: { $in: postIds }, user: userId });

    const voteMap = new Map(votes.map((v) => [v.post.toString(), v.value]));

    return keys.map((k) => voteMap.get(k.postId.toString()) || null);
  });
};

module.exports = createVoteLoader;
