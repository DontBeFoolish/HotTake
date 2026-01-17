const { GraphQLError } = require("graphql");

// ATHORIZATION

const isAdmin = (user) => user?.role === "ADMIN";
const isModerator = (user) => user?.role === "MODERATOR";
const isStaff = (user) => ["MODERATOR", "ADMIN"].includes(user?.role);

const requireAuth = (context, message = "authentication required") => {
  const user = context.currentUser;
  if (!user) {
    throw new GraphQLError(message, {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  return user;
};

const requireRole = (context, predicate, message = "not authorized") => {
  const user = requireAuth(context);
  if (!predicate(user)) {
    throw new GraphQLError(message, {
      extensions: { code: "FORBIDDEN" },
    });
  }
};

const requireAdmin = (context, message = "not authorized") => {
  requireRole(context, isAdmin, message);
};

const requireStaff = (context, message = "not authorized") => {
  requireRole(context, isStaff, message);
};

// OWNER CHECK

const isOwner = (user, resource) => user?.id === resource?.owner.toString();

const requireOwner = (context, resource, message = "not authorized") => {
  const user = requireAuth(context);
  if (!isOwner(user, resource)) {
    throw new GraphQLError(message, { extensions: { code: "FORBIDDEN" } });
  }
  return user;
};

const requireOwnerOrStaff = (context, resource, message = "not authorized") => {
  const user = requireAuth(context);
  if (!isOwner(user, resource) && !isStaff(user)) {
    throw new GraphQLError(message, {
      extensions: { code: "FORBIDDEN" },
    });
  }
};

// RESOURCE

const requireExists = (resource, message = "not found") => {
  if (!resource) {
    throw new GraphQLError(message, {
      extensions: { code: "NOT_FOUND" },
    });
  }
  return resource;
};

const requireCreated = (result, message = "operation failed") => {
  if (!result) {
    throw new GraphQLError(message, {
      extensions: { code: "INTERNAL_SERVER_ERROR" },
    });
  }
  return result;
};

// USER INPUT

const requireValidVote = (args, message = "invalid vote type") => {
  if (!["AGREE", "DISAGREE"].includes(args.value)) {
    throw new GraphQLError(message, {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
};

module.exports = {
  requireStaff,
  requireExists,
  requireCreated,
  requireOwner,
  requireAdmin,
  requireAuth,
  requireOwnerOrStaff,
  requireValidVote,
  isAdmin,
  isModerator,
  isOwner,
  isStaff,
};
