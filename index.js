require("dotenv").config();

const startServer = require("./server");
const connectToDb = require("./db");

const PORT = process.env.PORT || 4000;
const MONGODB_URI =
  process.env.NODE_ENV === "test"
    ? process.env.TEST_MONGODB_URI
    : process.env.MONGODB_URI;

const main = async () => {
  await connectToDb(MONGODB_URI);
  startServer(PORT);
};

main();
