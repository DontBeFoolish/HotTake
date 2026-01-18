const { GraphQLError } = require("graphql");

const isAdmin = (user) => user?.role === "ADMIN";
const isModerator = (user) => user?.role === "MODERATOR";
const isStaff = (user) => ["MODERATOR", "ADMIN"].includes(user?.role);

const requireAuth = (user, message = "authentication required") => {
  if (!user) {
    throw new GraphQLError(message, {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  return user;
};

const requireRole = (user, predicate, message = "not authorized") => {
  requireAuth(user);
  if (!predicate(user)) {
    throw new GraphQLError(message, {
      extensions: { code: "FORBIDDEN" },
    });
  }
};

const requireAdmin = (user, message = "not authorized") => {
  requireRole(user, isAdmin, message);
};

const requireStaff = (user, message = "not authorized") => {
  requireRole(user, isStaff, message);
};

const isOwner = (user, resource) => user.id === resource.owner.toString();

const requireOwner = (user, resource, message = "not authorized") => {
  requireAuth(user);
  if (!isOwner(user, resource)) {
    throw new GraphQLError(message, { extensions: { code: "FORBIDDEN" } });
  }
  return user;
};

const requireOwnerOrStaff = (user, resource, message = "not authorized") => {
  requireAuth(user);
  if (!isOwner(user, resource) && !isStaff(user)) {
    throw new GraphQLError(message, {
      extensions: { code: "FORBIDDEN" },
    });
  }
};

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

module.exports = {
  requireStaff,
  requireExists,
  requireCreated,
  requireOwner,
  requireAdmin,
  requireAuth,
  requireOwnerOrStaff,
  isAdmin,
  isModerator,
  isOwner,
  isStaff,
};
