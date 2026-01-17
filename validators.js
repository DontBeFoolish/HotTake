const { GraphQLError } = require("graphql");
const { Types } = require("mongoose");
const User = require("./models/user");

const validateVote = (args, message = "invalid vote type") => {
  if (!["AGREE", "DISAGREE"].includes(args.value)) {
    throw new GraphQLError(message, {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
};

const validateNewUser = async (args) => {
  if (await User.findOne({ username: args.username }, { _id: 1 })) {
    throw new GraphQLError("username already exists", {
      extensions: { code: "BAD_USER_INPUT", invalidArgs: args.username },
    });
  }

  const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;

  if (!USERNAME_REGEX.test(args.username)) {
    throw new GraphQLError(
      "Username must be 3-20 characters (letters, numbers, underscore, hyphen)",
      { extensions: { code: "BAD_USER_INPUT" } },
    );
  }

  const PASSWORD_REGEX =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])[^\s]{12,64}$/;

  if (!PASSWORD_REGEX.test(args.password)) {
    throw new GraphQLError(
      "Password must be at least 12 characters and include uppercase, lowercase, number, and symbol",
      { extensions: { code: "BAD_USER_INPUT" } },
    );
  }
};

const validateContent = (args) => {
  if (args?.content?.trim().length === 0) {
    throw new GraphQLError("Content cannot be empty", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  if (args.content.length >= 201) {
    throw new GraphQLError("Content exceeds maximum length", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
};

const validateObjectId = (id, fieldName = "id") => {
  if (!Types.ObjectId.isValid(id)) {
    throw new GraphQLError(`Invalid ${fieldName}`, {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
};

module.exports = {
  validateVote,
  validateNewUser,
  validateContent,
  validateObjectId,
};
