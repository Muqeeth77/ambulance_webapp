const jwt = require("jsonwebtoken");
const { TOKEN_EXPIRY } = require("../config/constants");

/**
 * Generate a signed JWT token for a user
 */
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || TOKEN_EXPIRY,
  });
};

/**
 * Verify a JWT token and return decoded payload
 */
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

/**
 * Decode a JWT without verifying (for non-sensitive reads)
 */
const decodeToken = (token) => {
  return jwt.decode(token);
};

module.exports = { generateToken, verifyToken, decodeToken };