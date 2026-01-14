const { GraphQLError, graphql, GraphQLBoolean } = require("graphql");
const jwt = require("jsonwebtoken");
const bcryptjs = require("bcryptjs");

const addVote = require("./services/voteService");

const Post = require("./models/post");
const User = require("./models/user");
const Vote = require("./models/vote");

const resolvers = {
  Query: {
    allUsers: async () => User.find({}),
    findUser: async (root, args) => User.find({ username: args.username }),
    allPosts: async () => Post.find({}),
    findPost: async (root, args) =>
      Post.findById(args.postId).populate("owner"),
    me: (root, args, context) => context.currentUser,
    allVotes: async () => Vote.find({}),
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

      return addVote({
        postId: args.postId,
        userId: context.currentUser.id,
        value: args.value,
      });
    },
  },
};

module.exports = resolvers;
