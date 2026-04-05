require("dotenv").config();
const http = require("http");
const app = require("./src/app");
const { initSockets } = require("./src/sockets");
const connectDB = require("./src/config/db");
const logger = require("./src/utils/logger");

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// ✅ Initialize Socket.io (IMPORTANT)
initSockets(server);

// ✅ Connect DB then start server
connectDB()
  .then(() => {
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV}]`);
    });
  })
  .catch((err) => {
    logger.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });

// ✅ Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    logger.info("Server closed.");
    process.exit(0);
  });
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception:", err.message);
  process.exit(1);
});