const rateLimit = require("express-rate-limit");
const logger = require("../utils/logger");

const globalRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit hit: ${req.ip} → ${req.originalUrl}`);
    res.status(429).json(options.message);
  },
});

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: "Too many login attempts. Please try again in 15 minutes.",
  },
});

const bookingRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many booking requests. Please wait a moment.",
  },
});

module.exports = { globalRateLimiter, authRateLimiter, bookingRateLimiter };