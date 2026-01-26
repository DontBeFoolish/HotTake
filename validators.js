const { GraphQLError } = require("graphql");
const { Types } = require("mongoose");
const User = require("./models/user");

const validateVote = (value, message = "invalid vote type") => {
  if (!["AGREE", "DISAGREE"].includes(value)) {
    throw new GraphQLError(message, {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
};

const validateNewUser = (user, exists) => {
  if (exists) {
    throw new GraphQLError("username already exists", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const USERNAME_REGEX = /^[a-zA-Z0-9_-]{4,20}$/;

  if (!USERNAME_REGEX.test(user.username)) {
    throw new GraphQLError(
      "Username must be 4-20 characters (letters, numbers, underscore, hyphen)",
      { extensions: { code: "BAD_USER_INPUT" } },
    );
  }

  const PASSWORD_REGEX =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])[^\s]{12,64}$/;

  const RELAXED_PASSWORD_REGEX = /^(?=.*[A-Z])[^\s]{4,}$/;


  if (!RELAXED_PASSWORD_REGEX.test(user.password)) {
    throw new GraphQLError(
      "Password must be at least 4 characters and include an uppercase letter",
      { extensions: { code: "BAD_USER_INPUT" } },
    );
  }
};

const validateContent = (content) => {
  if (content.length > 200) {
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

const validateRole = (role) => {
  if (!["USER", "MODERATOR", "ADMIN"].includes(role)) {
    throw new GraphQLError('not a valid role', {
      extensions: { code: "BAD_USER_INPUT" }
    })
  }
}

module.exports = {
  validateVote,
  validateNewUser,
  validateContent,
  validateObjectId,
  validateRole,
};
