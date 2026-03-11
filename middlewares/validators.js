import { body, param, query, validationResult } from "express-validator";

function validate(validations) {
    return async (req, res, next) => {
        for (const v of validations) await v.run(req);
        const errors = validationResult(req);
        if (errors.isEmpty()) return next();
        return res.status(400).json({
            error: "Validation failed",
            details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
        });
    };
}

//  Auth

export const validateSignUp = validate([
    body("username")
        .trim().notEmpty().withMessage("Full name is required."),
    body("firstname")
        .trim().notEmpty().withMessage("First name is required."),
    body("lastname")
        .trim().notEmpty().withMessage("Last name is required."),
    body("email")
        .trim().isEmail().withMessage("A valid email address is required.")
        .normalizeEmail(),
    body("password")
        .isLength({ min: 8 }).withMessage("Password must be at least 8 characters."),
    body("companyname")
        .trim()
        .notEmpty().withMessage("Company name is required.")
]);

export const validateLogin = validate([
    body("email")
        .trim().isEmail().withMessage("A valid email address is required.")
        .normalizeEmail(),
    body("password")
        .notEmpty().withMessage("Password is required."),
]);

export const validateForgotPassword = validate([
    body("email")
        .trim().isEmail().withMessage("A valid email address is required.")
        .normalizeEmail(),
])

export const validateResetPassword = validate([
    body("newPassword")
        .notEmpty().withMessage("Password is required."),
]);

// Admin: create employer

export const validateAdminCreateEmployer = validate([
    body("username")
        .trim().notEmpty().withMessage("Full name is required."),
    body("firstname")
        .trim().notEmpty().withMessage("First name is required."),
    body("lastname")
        .trim().notEmpty().withMessage("Last name is required."),
    body("email")
        .trim().isEmail().withMessage("A valid email address is required.")
        .normalizeEmail(),
    body("password")
        .isLength({ min: 8 }).withMessage("Password must be at least 8 characters."),
    body("role")
        .optional()
        .isIn(["employer", "admin"]).withMessage("Role must be 'employer' or 'admin'."),
    body("companyname")
        .trim()
        .notEmpty().withMessage("Company name is required.")
]);

//  Candidate

export const validateCandidateCreate = validate([
    // linkedinUrl is now optional — but if provided it must be a valid LinkedIn URL
    body("linkedinUrl")
        .optional({ checkFalsy: true })
        .trim()
        .matches(/^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9\-_%]+\/?(\?.*)?$/)
        .withMessage("Must be a valid LinkedIn profile URL (e.g. https://linkedin.com/in/yourname)."),
]);

export const validateCandidateUpdate = validate([
    body("fullName").optional().trim().notEmpty().withMessage("fullName cannot be empty."),
    body("email").optional().trim().isEmail().withMessage("Must be a valid email address."),
    body("phone").optional().trim(),
    body("location").optional().trim(),
    body("headline").optional().trim(),
    body("summary").optional().trim(),
    body("skills").optional().isArray().withMessage("Skills must be an array."),
    body("skills.*").trim().notEmpty().withMessage("Each skill must be a non-empty string."),
]);

export const validateListQuery = validate([
    query("page").optional().isInt({ min: 1 }).withMessage("page must be a positive integer."),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("limit must be between 1 and 100."),
    query("sortBy").optional().isIn(["createdAt", "fullName", "updatedAt"]).withMessage("Invalid sort field."),
    query("order").optional().isIn(["asc", "desc"]).withMessage("order must be 'asc' or 'desc'."),
]);

export const validateObjectId = validate([
    param("id").isMongoId().withMessage("Invalid ID."),
]);
