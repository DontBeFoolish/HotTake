const { ApolloServer } = require("@apollo/server");
const http = require("http");
const express = require("express");
const { WebSocketServer } = require("ws");
const { useServer } = require("graphql-ws/use/ws");
const {
  ApolloServerPluginDrainHttpServer,
} = require("@apollo/server/plugin/drainHttpServer");
const { expressMiddleware } = require("@as-integrations/express5");
const cors = require("cors");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const jwt = require("jsonwebtoken");

const createVoteLoader = require("./loaders/voteLoader");

const typeDefs = require("./schema");
const resolvers = require("./resolvers");
const User = require("./models/user");

const getUserFromAuthHeader = async (auth) => {
  if (!auth || !auth.startsWith("Bearer ")) {
    return null;
  }

  try {
    const decodedToken = jwt.verify(auth.substring(7), process.env.JWT_SECRET);
    return User.findById(decodedToken.id);
  } catch {
    return null;
  }
};

const startServer = async (port) => {
  const app = express();
  const httpServer = http.createServer(app);

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/",
  });

  const schema = makeExecutableSchema({ typeDefs, resolvers });
  const serverCleanup = useServer({ schema }, wsServer);

  const server = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await server.start();

  app.use(
    "/",
    cors(),
    express.json(),
    expressMiddleware(server, {
      context: async ({ req }) => {
        const auth = req.headers.authorization;
        const currentUser = await getUserFromAuthHeader(auth);
        return { currentUser, voteLoader: createVoteLoader() };
      },
    }),
  );

  httpServer.listen(port, () =>
    console.log(`Server is on http://localhost:${port}`),
  );
};

module.exports = startServer;
