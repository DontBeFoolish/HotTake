const mongoose = require("mongoose");

const connectToDb = async (uri) => {
  console.log("connecting to db");
  try {
    await mongoose.connect(uri);
    console.log("connected to db");
  } catch (error) {
    console.log("failed to connected to db");
    process.exit(1);
  }
};

module.exports = connectToDb;
