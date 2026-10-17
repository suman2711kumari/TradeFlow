const express = require("express");

const wrapAsync = require("../utils/wrapAsync.js");

const router = express.Router();

const {
    login,
    sendOtp,
    verifyOtp,
    registerUser,
    getCurrentUser,
    logout
} = require("../controllers/authController");

const auth = require("../controllers/authMiddleware");

router.post("/send-otp", sendOtp);

router.post("/verify-otp", verifyOtp);

router.post("/register", registerUser);

router.post(
    "/login",
    wrapAsync(login)
);
router.post("/logout", logout);
router.get(
    "/me",
    auth,
    wrapAsync(getCurrentUser)
);

module.exports = router;