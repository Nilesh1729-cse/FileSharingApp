const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/filesharingapp";

    if (mongoUri.includes("<db_password>")) {
      console.warn("⚠️  MongoDB URI contains '<db_password>' placeholder. Please replace it with your actual MongoDB password in .env.");
      return;
    }

    await mongoose.connect(mongoUri, {
      dbName: "FileSharingApp",
      serverSelectionTimeoutMS: 8000,
    });

    console.log(`✅ MongoDB connected successfully to database: ${mongoose.connection.name}`);
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    console.log("💡 Tip: Verify your MongoDB Atlas connection string and network access settings.");
  }
};

module.exports = connectDB;
