const { GraphQLError } = require("graphql");
const { PubSub } = require("graphql-subscriptions");
const jwt = require("jsonwebtoken");
const bcryptjs = require("bcryptjs");
const {
  requireStaff,
  requireAdmin,
  requireOwner,
  requireExists,
  requireCreated,
  requireAuth,
  requireOwnerOrStaff,
  isModerator,
} = require("./permissions");
const {
  validateVote,
  validateNewUser,
  validateContent,
  validateObjectId,
  validateRole,
} = require("./validators");

const Post = require("./models/post");
const User = require("./models/user");
const Vote = require("./models/vote");
const ModMessage = require("./models/modMessage");
const vote = require("./models/vote");

const pubsub = new PubSub();

const resolvers = {
  Query: {
    allPosts: async (root, args, context) => {
      const limit = 20;
      const query = { deleted: false };

      if (args.after) {
        validateObjectId(args.after);
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
          owner: context.currentUser.id,
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
    userPosts: async (root, args, context) => {
      validateObjectId(args.ownerId);

      const limit = 20;
      const query = { deleted: false, owner: args.ownerId };

      if (args.after) {
        validateObjectId(args.after);
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
          owner: context.currentUser.id,
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
    findPost: async (root, args) => {
      validateObjectId(args.postId);

      return Post.findOne({
        _id: args.postId,
        deleted: false,
      }).populate("owner");
    },
    allUsers: async (root, args, context) => {
      requireStaff(context.currentUser);
      User.find({});
    },
    findUser: async (root, args) => User.findOne({ username: args.username }),
    me: async (root, args, context) => {
      if (!context.currentUser) return null;

      const [voteCounts, totalPosts] = await Promise.all([
        Vote.aggregate([
          { $match: { owner: context.currentUser._id } },
          { $group: { _id: '$value', count: { $sum: 1 } } }
        ]),
        Post.countDocuments({ owner: context.currentUser._id, deleted: false }),
      ]);

      const voteMap = new Map(voteCounts.map(v => [v._id, v.count]));
      const agree = voteMap.get('AGREE') || 0;
      const disagree = voteMap.get('DISAGREE') || 0;
      const total = agree + disagree;

      context.currentUser.totalVotes = total;
      context.currentUser.totalPosts = totalPosts;
      context.currentUser.agreementRate = total === 0 ? null : Math.round((agree / total) * 100);

      return context.currentUser;
    },
    allModMessages: async (root, args, context) => {
      requireStaff(context.currentUser);

      const limit = 20;
      const query = { deleted: false };

      if (args.after) {
        validateObjectId(args.after);
        query._id = { $lt: args.after };
      }

      const messages = await ModMessage.find(query)
        .sort({ _id: -1 })
        .limit(limit + 1)
        .populate("owner");

      const hasMore = messages.length > limit;
      const sliced = hasMore ? messages.slice(0, limit) : messages;

      return {
        messages: sliced,
        nextCursor: hasMore ? sliced[sliced.length - 1]._id : null,
      };
    },
  },
  Mutation: {
    clearDb: async (root, args, context) => {
      requireAdmin(context.currentUser)
      
      await Post.deleteMany({});
      await User.deleteMany({});
      await Vote.deleteMany({});

      return true;
    },
    addUser: async (root, args) => {
      const trimmedUsername = args.username.trim()
      const trimmedPassword = args.password.trim()

      const exists = await User.findOne({ username: trimmedUsername }, { _id: 1 })

      validateNewUser({ username: trimmedUsername, password: trimmedPassword }, exists);

      const hashedPassword = await bcryptjs.hash(trimmedPassword, 10);

      const newUser = new User({
        username: trimmedUsername,
        passwordHash: hashedPassword,
      });

      return newUser.save();
    },
    setUserRole: async (root, args, context) => {
      requireAdmin(context.currentUser);
      validateObjectId(args.userId);
      validateRole(args.role);

      const user = await User.findById(args.userId);
      requireExists(user);

      user.role = args.role;
      return user.save();
    },
    setBio: async (root, args, context) => {
      const user = requireAuth(context.currentUser);

      const trimmedBio = args.content.trim()
      validateContent(trimmedBio);

      user.bio = trimmedBio;
      return user.save()
    },
    login: async (root, args, context) => {
      if (context.currentUser) {
        throw new GraphQLError("already signed in", {
          extensions: { code: "FORBIDDEN" },
        });
      }

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
      const user = requireAuth(context.currentUser);

      const trimmedContent = args.content.trim()
      validateContent(trimmedContent);

      const newPost = new Post({
        content: trimmedContent,
        owner: user.id,
      });

      const savedPost = await newPost.save();
      requireCreated(savedPost);

      const populatedPost = await savedPost.populate("owner");

      pubsub.publish("POST_ADDED", { postAdded: populatedPost });
      return populatedPost;
    },
    removePost: async (root, args, context) => {
      requireAuth(context.currentUser);
      validateObjectId(args.postId);

      const post = await Post.findOne({
        _id: args.postId,
        deleted: false,
      });

      requireExists(post);
      requireOwnerOrStaff(context.currentUser, post);

      post.deleted = true;
      return post.save();
    },
    addVote: async (root, args, context) => { // requires refactor
      requireAuth(context.currentUser);
      validateObjectId(args.postId);
      validateVote(args.value);

      const session = await Vote.startSession();

      try {
        await session.startTransaction();

        const post = await Post.findOne({
          _id: args.postId,
          deleted: false,
        }).session(session);

        requireExists(post);

        const existingVote = await Vote.findOne({
          owner: context.currentUser.id,
          post: post.id,
        }).session(session);

        const fieldFor = (value) =>
          value === "AGREE" ? "votes.agree" : "votes.disagree";

        let inc = {};
        let finalUserVote = null;

        if (!existingVote) {
          const vote = new Vote({
            owner: context.currentUser.id,
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

        const updatedPost = await Post.findOneAndUpdate(
          { _id: args.postId, deleted: false },
          { $inc: inc },
          { new: true, session },
        ).populate("owner");

        requireExists(updatedPost)

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
    addModMessage: async (root, args, context) => {
      requireStaff(context.currentUser);
      validateContent(args.content);

      const newMessage = new ModMessage({
        content: args.content,
        owner: context.currentUser.id,
        role: context.currentUser.role,
      });

      const savedMessage = await newMessage.save();
      requireCreated(savedMessage);

      const populatedMessage = await savedMessage.populate("owner");

      pubsub.publish("MOD_MESSAGE", {
        modMessage: {
          type: "ADDED",
          message: populatedMessage,
          messageId: null,
        },
      });

      return populatedMessage;
    },
    removeModMessage: async (root, args, context) => {
      requireStaff(context.currentUser);
      validateObjectId(args.messageId);

      const messageToDelete = await ModMessage.findById(args.messageId);
      requireExists(messageToDelete);

      if (isModerator(context.currentUser)) {
        requireOwner(context.currentUser, messageToDelete);
      }

      messageToDelete.deleted = true;
      const deletedMessage = await messageToDelete.save();

      pubsub.publish("MOD_MESSAGE", {
        modMessage: {
          type: "REMOVED",
          message: null,
          messageId: deletedMessage.id,
        },
      });

      return deletedMessage;
    },
  },
  Subscription: {
    postAdded: {
      subscribe: () => pubsub.asyncIterableIterator("POST_ADDED"),
    },
    modMessage: {
      subscribe: (root, args, context) => {
        requireStaff(context.currentUser);
        return pubsub.asyncIterableIterator("MOD_MESSAGE");
      },
    },
  },
  Post: {
    controversyScore: (root) => {
      const { agree, disagree } = root.votes;
      if (agree === 0 && disagree === 0) return null;
      return Math.min(agree, disagree) / Math.max(agree, disagree);
    },
  },
  User: {
    totalVotes: (root) => {
      return root.totalVotes ?? Vote.countDocuments({ owner: root._id });
    },
    totalPosts: (root) => {
      return root.totalPosts ?? Post.countDocuments({ owner: root._id, deleted: false });
    },
    agreementRate: async (root) => {
      if (root.agreementRate !== undefined) return root.agreementRate;
      const votes = await Vote.aggregate([
        { $match: { owner: root._id } },
        { $group: { _id: '$value', count: { $sum: 1 } } }
      ]);

      const voteMap = new Map(votes.map(v => [v._id, v.count]))
      const agree = voteMap.get('AGREE') || 0;
      const disagree = voteMap.get('DISAGREE') || 0;
      const total = agree + disagree;

      return total === 0 ? null : Math.round((agree / total) * 100)
    }
  },
};

module.exports = resolvers;
