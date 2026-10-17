const jwt = require("jsonwebtoken");

// Set JWT_SECRET in backend/.env. The fallback preserves compatibility with older local setups.
const JWT_SECRET = process.env.JWT_SECRET || "secretkey";

const auth = (req, res, next) => {
    try {
        const token = req.cookies?.token;

        if (!token) {
            return res.status(401).json({
                message: "Not authenticated"
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.id;

        next();

    } catch (err) {
        return res.status(401).json({
            message: "Invalid token"
        });
    }
};

module.exports = auth;