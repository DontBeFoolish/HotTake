const { GraphQLError } = require("graphql");
const { PubSub } = require("graphql-subscriptions");
const jwt = require("jsonwebtoken");
const bcryptjs = require("bcryptjs");

const Post = require("./models/post");
const User = require("./models/user");
const Vote = require("./models/vote");

const pubsub = new PubSub();

const resolvers = {
  Query: {
    allPosts: async (root, args) => {
      if (args.content) {
        return Post.find({ $text: { $search: args.content } }).populate(
          "owner",
        );
      }
      return Post.find({}).populate("owner");
    },
    userPosts: async (root, args) =>
      Post.find({ owner: args.ownerId }).populate("owner"),
    findPost: async (root, args) =>
      Post.findById(args.postId).populate("owner"),
    allUsers: async () => User.find({}),
    findUser: async (root, args) => User.findOne({ username: args.username }),
    me: (root, args, context) => context.currentUser,
  },
  Mutation: {
    clearDb: async () => {
      await Post.deleteMany({});
      await User.deleteMany({});
      await Vote.deleteMany({});

      return true;
    },
    addUser: async (root, args) => {
      if (args.password.length < 8) {
        throw new GraphQLError("password minimum length of 8", {
          extensions: { code: "BAD_USER_INPUT", invalidArgs: args.password },
        });
      }

      if (await User.findOne({ username: args.username })) {
        throw new GraphQLError("username already exists", {
          extensions: { code: "BAD_USER_INPUT", invalidArgs: args.username },
        });
      }

      const hashRounds = 10;
      const hashedPassword = await bcryptjs.hash(args.password, hashRounds);

      const newUser = new User({
        username: args.username,
        passwordHash: hashedPassword,
      });

      return newUser.save().catch((error) => {
        throw new GraphQLError("failed to save user", {
          extensions: { code: "INTERNAL_SERVER_ERROR", error: error.message },
        });
      });
    },
    login: async (root, args) => {
      const user = await User.findOne({ username: args.username });
      if (
        !user ||
        !(await bcryptjs.compare(args.password, user.passwordHash))
      ) {
        throw new GraphQLError("bad credentials", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const userForToken = {
        username: args.username,
        id: user._id,
      };

      return { value: jwt.sign(userForToken, process.env.JWT_SECRET) };
    },
    addPost: async (root, args, context) => {
      if (!context.currentUser) {
        throw new GraphQLError("must be logged in to create post", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      const newPost = new Post({
        content: args.content,
        owner: context.currentUser.id,
      });

      const savedPost = await newPost.save().catch((error) => {
        throw new GraphQLError("failed to create post", {
          extensions: { code: "INTERNAL_SERVER_ERROR", error: error.message },
        });
      });
      const populatedPost = await savedPost.populate("owner");

      pubsub.publish("POST_ADDED", { postAdded: populatedPost });
      return populatedPost;
    },
    removePost: async (root, args, context) => {
      if (!context.currentUser) {
        throw new GraphQLError("no authentication", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      const post = await Post.findById(args.postId);
      if (!post) {
        throw new GraphQLError("post not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      if (post.owner.toString() !== context.currentUser.id) {
        throw new GraphQLError("must be owner to delete", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      await post.deleteOne();
      return true;
    },
    addVote: async (root, args, context) => {
      if (!context.currentUser) {
        throw new GraphQLError("no authentication", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      if (args.value !== "AGREE" && args.value !== "DISAGREE") {
        throw new GraphQLError("invalid vote value", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const session = await Vote.startSession();

      try {
        await session.startTransaction();

        const post = await Post.findById(args.postId).session(session);
        if (!post) {
          throw new GraphQLError("post not found", {
            extensions: { code: "NOT_FOUND" },
          });
        }

        const existingVote = await Vote.findOne({
          user: context.currentUser.id,
          post: post.id,
        }).session(session);

        const fieldFor = (value) =>
          value === "AGREE" ? "votes.agree" : "votes.disagree";

        let inc = {};
        let finalUserVote = null;

        // vote doesn't exist -> add vote
        if (!existingVote) {
          const vote = new Vote({
            user: context.currentUser.id,
            post: post.id,
            value: args.value,
          });

          await vote.save({ session });

          inc[fieldFor(args.value)] = 1;
          finalUserVote = args.value;
        }

        // same vote value -> remove vote
        else if (existingVote.value === args.value) {
          await existingVote.deleteOne({ session });

          inc[fieldFor(args.value)] = -1;
          finalUserVote = null;
        }

        // opposite vote value -> switch vote
        else {
          const prevValue = existingVote.value;
          existingVote.value = args.value;

          await existingVote.save({ session });

          inc[fieldFor(prevValue)] = -1;
          inc[fieldFor(args.value)] = 1;
          finalUserVote = args.value;
        }

        const updatedPost = await Post.findByIdAndUpdate(
          args.postId,
          { $inc: inc },
          { new: true, session },
        ).populate("owner");

        await session.commitTransaction();

        updatedPost.userVote = finalUserVote;
        return updatedPost;
      } catch (error) {
        await session.abortTransaction();

        if (error instanceof GraphQLError) {
          throw error;
        }

        throw new GraphQLError("failed to process vote", {
          extensions: { code: "INTERNAL_SERVER_ERROR", error: error.message },
        });
      } finally {
        session.endSession();
      }
    },
  },
  Subscription: {
    postAdded: {
      subscribe: () => pubsub.asyncIterableIterator("POST_ADDED"),
    },
  },
  Post: {
    controversyScore: (root) => {
      const { agree, disagree } = root.votes;
      if (agree === 0 && disagree === 0) return null;
      return Math.min(agree, disagree) / Math.max(agree, disagree);
    },
    userVote: async (root, _, context) => {
      if (!context.currentUser) return null;

      const vote = await Vote.findOne({
        post: root.id,
        user: context.currentUser.id,
      });

      return vote ? vote.value : null;
    },
  },
};

module.exports = resolvers;
