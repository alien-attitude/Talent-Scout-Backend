// eslint-disable-next-line no-unused-vars
export default function errorHandler(err, req, res, next) {
    const status = err.status || err.statusCode || 500;

    if (err.name === "ValidationError") {
        return res.status(400).json({
            error: "Database validation failed",
            details: Object.values(err.errors).map((e) => ({
                field: e.path,
                message: e.message,
            })),
        });
    }

    // src/middleware/errorHandler.js

    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || "field";
        const value = Object.values(err.keyValue || {})[0] || "";

        // Generic message that works for any collection
        return res.status(409).json({
            error: `${field} "${value}" is already taken. Please use a different one.`,
            code:  "DUPLICATE_KEY",
        });
    }

    if (err.name === "CastError") {
        return res.status(400).json({ error: "Invalid ID format.", code: "INVALID_ID" });
    }

    const isDev = process.env.NODE_ENV !== "production";
    console.error(`[${new Date().toISOString()}] ${status} ${req.method} ${req.path}`, err.message);

    res.status(status).json({
        error: err.message || "Internal server error",
        ...(isDev && { stack: err.stack }),
    });
}
