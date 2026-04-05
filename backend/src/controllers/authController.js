const { validationResult } = require("express-validator");
const User = require("../models/User");
const { generateToken } = require("../utils/jwt");
const { createError } = require("../middleware/errorHandler");
const logger = require("../utils/logger");

// ================= REGISTER =================
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, phone, password, role } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return next(
        createError(
          existingUser.email === email
            ? "Email already registered."
            : "Phone number already registered.",
          409
        )
      );
    }

    // ✅ allow police role
    const allowedRoles = ["user", "driver", "police", "admin"];
    const assignedRole = allowedRoles.includes(role) ? role : "user";

    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: assignedRole,
    });

    const token = generateToken(user._id);

    logger.info(`New user registered: ${user.email} [${user.role}]`);

    res.status(201).json({
      success: true,
      message: "Registration successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ================= LOGIN =================
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return next(createError("Invalid email or password.", 401));
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return next(createError("Invalid email or password.", 401));
    }

    if (user.isBlocked) {
      return next(createError("Your account has been blocked.", 403));
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);

    logger.info(`User logged in: ${user.email} [${user.role}]`);

    res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role, // ✅ IMPORTANT
      },
    });
  } catch (err) {
    next(err);
  }
};

// ================= GET ME =================
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.status(200).json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

// ================= UPDATE PROFILE =================
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, address } = req.body;

    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { name, phone, address },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Profile updated.",
      user: updated,
    });
  } catch (err) {
    next(err);
  }
};

// ================= CHANGE PASSWORD =================
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select("+password");
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return next(createError("Current password is incorrect.", 400));
    }

    user.password = newPassword;
    await user.save();

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: "Password changed successfully.",
      token,
    });
  } catch (err) {
    next(err);
  }
};

// ================= LOGOUT =================
const logout = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, message: "Logged out successfully." });
  } catch (err) {
    next(err);
  }
};

// ================= EXPORT =================
module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  logout,
};