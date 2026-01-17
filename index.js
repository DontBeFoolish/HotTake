require("dotenv").config();

const startServer = require("./server");
const connectToDb = require("./db");

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be defined");
}

const main = async () => {
  await connectToDb(MONGODB_URI);
  startServer(PORT);
};

main();
