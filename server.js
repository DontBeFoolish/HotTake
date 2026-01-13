const { ApolloServer } = require("@apollo/server");
const { startStandaloneServer } = require("@apollo/server/standalone");
const jwt = require("jsonwebtoken");

const typeDefs = require("./schema");
const resolvers = require("./resolvers");
const User = require("./models/user");

const getUserFromAuthHeader = async (auth) => {
  if (!auth || !auth.startsWith("Bearer ")) {
    return null;
  }

  const decodedToken = jwt.verify(auth.substring(7), process.env.JWT_SECRET);
  return User.findById(decodedToken.id);
};

const startServer = (port) => {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
  });

  startStandaloneServer(server, {
    listen: { port: 4000 },
    context: async ({ req }) => {
      const auth = req.headers.authorization;
      const currentUser = await getUserFromAuthHeader(auth);
      return { currentUser };
    },
  }).then(({ url }) => {
    console.log(`live at ${url}`);
  });
};

module.exports = startServer;
