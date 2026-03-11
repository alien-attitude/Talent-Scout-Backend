import jwt from "jsonwebtoken";
import Employer from "../schemas/employer.schema.js";

/**
 * authenticate — verifies the JWT stored in the HTTP-only cookie.
 *
 * On success: attaches `req.employer` (the logged-in employer document)
 * On failure: returns 401
 *
 * Why cookies instead of Authorization header?
 * HTTP-only cookies cannot be read by JavaScript, so they are immune
 * to XSS attacks that could steal tokens from localStorage.
 */
export async function authenticate(req, res, next) {
    try {
        const token = req.cookies?.accessToken;

        if (!token) {
            return res.status(401).json({
                error: "Not authenticated. Please log in.",
                code:  "NO_TOKEN",
            });
        }

        // Verify the token — throws if expired or tampered with
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET );
        } catch (err) {
            const code    = err.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "INVALID_TOKEN";
            const message = err.name === "TokenExpiredError"
                ? "Session expired. Please log in again."
                : "Invalid token. Please log in again.";
            return res.status(401).json({ error: message, code });
        }

        // Fetch the employer fresh from DB so deactivated accounts are blocked
        const employer = await Employer.findById(decoded.id).select("-password");

        if (!employer) {
            return res.status(401).json({
                error: "Account not found. Please log in again.",
                code:  "EMPLOYER_NOT_FOUND",
            });
        }

        if (!employer.isActive) {
            return res.status(403).json({
                error: "Your account has been deactivated. Contact an administrator.",
                code:  "ACCOUNT_DEACTIVATED",
            });
        }

        // Attach to request — all downstream controllers can use req.employer
        req.employer = employer;
        next();
    } catch (err) {
        next(err);
    }
}

/**
 * authorize — role-based access control.
 *
 * Usage:  authorize("admin") — admin only
 *         authorize("admin", "employer") — both roles
 *
 * Always placed AFTER authenticate in the middleware chain.
 */
export function authorize(...roles) {
    return (req, res, next) => {
        if (!req.employer) {
            return res.status(401).json({ error: "Not authenticated.", code: "NOT_AUTHENTICATED" });
        }

        if (!roles.includes(req.employer.role)) {
            return res.status(403).json({
                error: `Access denied. Required role: ${roles.join(" or ")}.`,
                code:  "FORBIDDEN",
            });
        }

        next();
    };
}
