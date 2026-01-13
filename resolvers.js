const { GraphQLError } = require("graphql");
const jwt = require("jsonwebtoken");
const bcryptjs = require("bcryptjs");

const Post = require("./models/post");
const User = require("./models/user");
const Vote = require("./models/vote");

const resolvers = {
  Query: {
    me: (root, args, context) => context.currentUser,
    allPosts: async () => Post.find({}),
    findPost: async (root, args) =>
      Post.findById(args.postId).populate("owner"),
    allUsers: async () => User.find({}),
    findUser: async (root, args) => User.find({ username: args.username }),
  },
  Mutation: {
    addUser: async (root, args) => {
      if (args.password.length < 8) {
        throw new GraphQLError("password minimum length of 8", {
          extensions: {
            code: "BAD_USER_INPUT",
            invalidArgs: args.password,
          },
        });
      }

      const hashRounds = 10;
      const hashedPassword = await bcryptjs.hash(args.password, hashRounds);

      const newUser = new User({
        username: args.username,
        passwordHash: hashedPassword,
      });

      return newUser.save().catch((error) => {
        throw new GraphQLError(`failed to save user ${error.message}`, {
          extensions: {
            code: "BAD_USER_INPUT",
            invalidArgs: args.username,
            error,
          },
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
      const user = await User.findById(context.currentUser.id);
      if (!user) {
        throw new GraphQLError("must be logged in to create post", {
          extensions: {
            code: "UNAUTHENTICATED",
            error,
          },
        });
      }

      const newPost = new Post({
        title: args.title,
        body: args.body,
        owner: context.currentUser.id,
      });

      const savedPost = await newPost.save().catch((error) => {
        throw new GraphQLError("failed to create post", {
          extensions: {
            code: "BAD_USER_INPUT",
            error,
          },
        });
      });

      return savedPost.populate("owner");
    },
  },
};

module.exports = resolvers;
