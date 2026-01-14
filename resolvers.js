const { GraphQLError } = require("graphql");
const jwt = require("jsonwebtoken");
const bcryptjs = require("bcryptjs");

const Post = require("./models/post");
const User = require("./models/user");
const Vote = require("./models/vote");

const resolvers = {
  Query: {
    me: (root, args, context) => context.currentUser,
    allPosts: async () => Post.find({}).populate("owner"),
    findPost: async (root, args) =>
      Post.findById(args.postId).populate("owner"),
    allUsers: async () => User.find({}),
    findUser: async (root, args) => User.findOne({ username: args.username }),
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
        title: args.title,
        body: args.body,
        owner: context.currentUser.id,
      });

      const savedPost = await newPost.save().catch((error) => {
        throw new GraphQLError("failed to create post", {
          extensions: { code: "INTERNAL_SERVER_ERROR", error: error.message },
        });
      });

      return savedPost.populate("owner");
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

      const post = await Post.findById(args.postId);
      if (!post) {
        throw new GraphQLError("post not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      let existingVote = await Vote.findOne({
        user: context.currentUser.id,
        post: post.id,
      });

      const fieldFor = (value) =>
        value === "AGREE" ? "votes.agree" : "votes.disagree";

      let inc = {};

      // vote doesn't exist -> add vote
      if (!existingVote) {
        const vote = new Vote({
          user: context.currentUser.id,
          post: post.id,
          value: args.value,
        });

        try {
          await vote.save();
          inc[fieldFor(args.value)] = 1;
        } catch (error) {
          if (error.code === 11000) {
            existingVote = await Vote.findOne({
              user: context.currentUser.id,
              post: post.id,
            });

            const currentPost = await Post.findById(post.id).populate("owner");
            currentPost.userVote = existingVote?.value ?? null;
            return currentPost;
          }

          throw new GraphQLError("failed to save vote", {
            extensions: { code: "INTERNAL_SERVER_ERROR", error: error.message },
          });
        }
      }

      // same vote value -> remove vote
      else if (existingVote.value === args.value) {
        await existingVote.deleteOne().catch((error) => {
          throw new GraphQLError("failed to delete vote", {
            extensions: { code: "INTERNAL_SERVER_ERROR", error: error.message },
          });
        });

        inc[fieldFor(args.value)] = -1;
      }

      // opposite vote value -> switch vote
      else {
        const prevValue = existingVote.value;
        existingVote.value = args.value;
        await existingVote.save().catch((error) => {
          throw new GraphQLError("failed to update vote", {
            extensions: { code: "INTERNAL_SERVER_ERROR", error: error.message },
          });
        });

        inc[fieldFor(prevValue)] = -1;
        inc[fieldFor(args.value)] = 1;
      }

      const updatedPost = await Post.findByIdAndUpdate(
        args.postId,
        { $inc: inc },
        { new: true },
      ).populate("owner");

      updatedPost.userVote =
        existingVote && existingVote.value === args.value ? null : args.value;

      return updatedPost;
    },
  },
  Post: {
    controversyScore: (root) => {
      const { agree, disagree } = root.votes;
      if (agree === 0 && disagree === 0) return 0;
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
