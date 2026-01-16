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
    allPosts: async (root, args, context) => {
      const limit = 20;
      const query = { deleted: false };

      if (args.after) {
        query._id = { $lt: args.after };
      }

      const posts = await Post.find(query)
        .sort({ _id: -1 })
        .limit(limit + 1)
        .populate("owner");

      const hasMore = posts.length > limit;
      const sliced = hasMore ? posts.slice(0, limit) : posts;

      if (context.currentUser) {
        const votes = await Vote.find({
          user: context.currentUser.id,
          post: { $in: sliced.map((p) => p._id) },
        });

        const voteMap = new Map(votes.map((v) => [v.post.toString(), v.value]));
        sliced.forEach((post) => {
          post.userVote = voteMap.get(post._id.toString()) || null;
        });
      }

      return {
        posts: sliced,
        nextCursor: hasMore ? sliced[sliced.length - 1]._id : null,
      };
    },
    userPosts: async (root, args) => {
      const limit = 20;
      const query = { deleted: false, owner: args.ownerId };

      if (args.after) {
        query._id = { $lt: args.after };
      }

      const posts = await Post.find(query)
        .sort({ _id: -1 })
        .limit(limit + 1)
        .populate("owner");

      const hasMore = posts.length > limit;
      const sliced = hasMore ? posts.slice(0, limit) : posts;

      return {
        posts: sliced,
        nextCursor: hasMore ? sliced[sliced.length - 1]._id : null,
      };
    },
    findPost: async (root, args) => {
      return Post.findOne({
        _id: args.postId,
        deleted: false,
      }).populate("owner");
    },
    allUsers: async (root, args, context) => {
      if (context.currentUser?.role !== "ADMIN") {
        throw new GraphQLError("not authorized", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      return User.find({});
    },
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
      if (await User.findOne({ username: args.username }, { _id: 1 })) {
        throw new GraphQLError("username already exists", {
          extensions: { code: "BAD_USER_INPUT", invalidArgs: args.username },
        });
      }

      const PASSWORD_REGEX =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])[^\s]{12,}$/;

      if (!PASSWORD_REGEX.test(args.password)) {
        throw new GraphQLError(
          "Password must be at least 12 characters and include uppercase, lowercase, number, and symbol",
          { extensions: { code: "BAD_USER_INPUT" } },
        );
      }

      const hashedPassword = await bcryptjs.hash(args.password, 10);

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
    setUserRole: async (root, args, context) => {
      if (context.currentUser?.role !== "ADMIN") {
        throw new GraphQLError("not authorized", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      const user = await User.findById(args.userId);
      if (!user) {
        throw new GraphQLError("invalid user id", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      user.role = args.role;
      return user.save();
    },
    login: async (root, args) => {
      const user = await User.findOne({ username: args.username }).select(
        "+passwordHash",
      );
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

      const savedPost = await newPost.save();

      if (!savedPost) {
        throw new GraphQLError("failed to create post", {
          extensions: { code: "INTERNAL_SERVER_ERROR", error: error.message },
        });
      }

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

      const post = await Post.findOne({
        _id: args.postId,
        deleted: false,
      });

      if (!post) {
        throw new GraphQLError("post not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      const isMod = ["MODERATOR", "ADMIN"].includes(context.currentUser.role);
      const isOwner = context.currentUser.id === post.owner.toString();

      if (!isMod && !isOwner) {
        throw new GraphQLError("no permission to delete post", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      post.deleted = true;
      return post.save();
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

        const post = await Post.findOne({
          _id: args.postId,
          deleted: false,
        }).session(session);

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

        if (!existingVote) {
          const vote = new Vote({
            user: context.currentUser.id,
            post: post.id,
            value: args.value,
          });

          await vote.save({ session });

          inc[fieldFor(args.value)] = 1;
          finalUserVote = args.value;
        } else if (existingVote.value === args.value) {
          await existingVote.deleteOne({ session });

          inc[fieldFor(args.value)] = -1;
          finalUserVote = null;
        } else {
          const prevValue = existingVote.value;
          existingVote.value = args.value;

          await existingVote.save({ session });

          inc[fieldFor(prevValue)] = -1;
          inc[fieldFor(args.value)] = 1;
          finalUserVote = args.value;
        }

        const updatedPost = await Post.findByIdAndUpdate(
          { _id: args.postId, deleted: false },
          { $inc: inc },
          { new: true, session },
        ).populate("owner");

        if (!updatedPost) {
          throw new GraphQLError("post does not exist", {
            extensions: { code: "NOT_FOUND" },
          });
        }

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
    userVote: async (root) => root.userVote ?? null,
  },
};

module.exports = resolvers;
