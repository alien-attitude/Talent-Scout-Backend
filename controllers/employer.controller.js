import Employer from "../schemas/employer.schema.js";

/**
 * employerController.js
 *
 * Handles actions an employer performs on their own account.
 * Every function operates on req.employer._id — the authenticated user.
 * Employers cannot modify other employers' accounts through these routes.
 */

// GET /api/employer/profile
export async function getProfile(req, res, next) {
    try {
        // req.employer is already attached by authenticate middleware
        // Re-fetch from DB to guarantee we return the freshest data
        const employer = await Employer.findById(req.employer._id).lean();

        if (!employer) {
            return res.status(404).json({ error: "Employer account not found." });
        }

        res.json({ employer });
    } catch (err) {
        next(err);
    }
}

// PATCH /api/employer/profile
export async function updateProfile(req, res, next) {
    try {
        const ALLOWED_FIELDS = ["username", "firstname", "lastname", "companyname"];

        const updates = {};
        for (const key of ALLOWED_FIELDS) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: "No valid fields to update." });
        }

        const employer = await Employer.findByIdAndUpdate(
            req.employer._id,
            { $set: updates },
            { new: true, runValidators: true }
        ).lean();

        res.json({ message: "Profile updated successfully.", employer });
    } catch (err) {
        next(err);
    }
}

// PATCH /api/employer/change-password
export async function changePassword(req, res, next) {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                error: "Both currentPassword and newPassword are required.",
                code:  "MISSING_FIELDS",
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                error: "New password must be at least 8 characters.",
                code:  "PASSWORD_TOO_SHORT",
            });
        }

        // select: false on password field means we must explicitly request it
        const employer = await Employer.findById(req.employer._id).select("+password");

        const isMatch = await employer.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({
                error: "Current password is incorrect.",
                code:  "WRONG_PASSWORD",
            });
        }

        // Assign to the document and call .save() so the pre-save hook
        // re-hashes the new password automatically
        employer.password = newPassword;
        await employer.save();

        res.json({ message: "Password changed successfully." });
    } catch (err) {
        next(err);
    }
}
