const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const dotenv = require("dotenv");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const fileEvents = require("./events/fileEvents");

// Load environment variables
dotenv.config();

// Connect to Database
connectDB();

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Uploads Directory statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Socket.io Connection & Event Bridge
io.on("connection", (socket) => {
  console.log(`🔌 New client connected: ${socket.id}`);

  socket.on("join-user-room", (userId) => {
    socket.join(`user_${userId}`);
    console.log(`👤 Socket ${socket.id} joined room user_${userId}`);
  });

  socket.on("disconnect", () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Bridge internal event emitter to Socket.io real-time updates
fileEvents.on("FILE_UPLOADED", (data) => {
  io.emit("file:uploaded", data);
  if (data.userId) {
    io.to(`user_${data.userId}`).emit("user:file:uploaded", data);
  }
});

fileEvents.on("FILE_DOWNLOADED", (data) => {
  io.emit("file:downloaded", data);
});

fileEvents.on("FILE_DELETED", (data) => {
  io.emit("file:deleted", data);
  if (data.userId) {
    io.to(`user_${data.userId}`).emit("user:file:deleted", data);
  }
});

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/files", require("./routes/files"));

// Health Check Endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "CloudShare File Sharing API is running",
    timestamp: new Date().toISOString(),
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === "production" ? {} : err,
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 File Sharing Server running on http://localhost:${PORT}`);
  console.log(`📁 Health Check: http://localhost:${PORT}/api/health`);
});

module.exports = { app, server, io };
