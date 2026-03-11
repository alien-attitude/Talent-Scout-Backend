import Employer from "../schemas/employer.schema.js";
import Candidate from "../schemas/candidate.schema.js";
import fs from "fs";

/**
 * All functions here require: authenticate + authorize("admin")
 * That is enforced in the route file, not here.
 * Controllers stay clean — no auth logic inside them.
 */

//  GET /api/admin/employers
export async function getAllEmployers(req, res, next) {
    try {
        const page   = Math.max(1, parseInt(req.query.page)  || 1);
        const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip   = (page - 1) * limit;
        const search = req.query.search?.trim();

        const filter = {};
        if (search) {
            filter.$or = [
                { fullName: { $regex: search, $options: "i" } },
                { email:    { $regex: search, $options: "i" } },
                { company:  { $regex: search, $options: "i" } },
            ];
        }

        const [employers, total] = await Promise.all([
            Employer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Employer.countDocuments(filter),
        ]);

        res.json({
            employers,
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
        });
    } catch (err) {
        next(err);
    }
}

// POST /api/admin/employers
// Admins create other employers (including other admins)
export async function createEmployer(req, res, next) {
    try {
        const { username, firstname, lastname, email, password, companyname, role } = req.body;

        const existing = await Employer.findOne({ email });
        if (existing) {
            return res.status(409).json({
                error: "An account with this email already exists.",
                code:  "EMAIL_TAKEN",
            });
        }

        // Admin can set role to "admin" or "employer" — defaults to "employer"
        const employer = await Employer.create({
            username,
            firstname,
            lastname,
            email,
            password,
            companyname: companyname || "",
            role: role === "admin" ? "admin" : "employer",
        });

        const { password: _pw, ...safe } = employer.toObject();
        res.status(201).json({ message: "Employer created.", employer: safe });
    } catch (err) {
        next(err);
    }
}

// DELETE /api/admin/employers/:id
export async function deleteEmployer(req, res, next) {
    try {
        // Prevent an admin from deleting themselves
        if (req.params.id === req.employer._id.toString()) {
            return res.status(400).json({
                error: "You cannot delete your own account.",
                code:  "SELF_DELETE",
            });
        }

        const employer = await Employer.findByIdAndDelete(req.params.id);
        if (!employer) {
            return res.status(404).json({ error: "Employer not found." });
        }

        res.json({ message: "Employer deleted.", id: req.params.id });
    } catch (err) {
        next(err);
    }
}

//  PATCH /api/admin/employers/:id
// Admins can deactivate accounts or change roles
export async function updateEmployer(req, res, next) {
    try {
        const ALLOWED = ["fullName", "company", "role", "isActive"];
        const updates = {};
        for (const key of ALLOWED) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: "No valid fields to update." });
        }

        const employer = await Employer.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: true }
        ).lean();

        if (!employer) return res.status(404).json({ error: "Employer not found." });

        res.json({ message: "Employer updated.", employer });
    } catch (err) {
        next(err);
    }
}

// GET /api/admin/candidates
// Admins can see ALL candidates regardless of who added them
export async function getAllCandidates(req, res, next) {
    try {
        const page   = Math.max(1, parseInt(req.query.page)  || 1);
        const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip   = (page - 1) * limit;
        const sortBy = req.query.sortBy || "createdAt";
        const order  = req.query.order === "asc" ? 1 : -1;
        const search = req.query.search?.trim();

        const filter = {};
        if (req.query.employerId) filter.employerId = req.query.employerId;
        if (req.query.status)     filter.processingStatus = req.query.status;
        if (search) {
            filter.$or = [
                { fullName: { $regex: search, $options: "i" } },
                { headline: { $regex: search, $options: "i" } },
                { skills:   { $elemMatch: { $regex: search, $options: "i" } } },
            ];
        }

        const [candidates, total] = await Promise.all([
            Candidate.find(filter)
                .select("-rawLinkedinData -rawCvData -uploadedFile")
                .populate("employerId", "fullName email company") // show who added each candidate
                .sort({ [sortBy]: order })
                .skip(skip)
                .limit(limit)
                .lean(),
            Candidate.countDocuments(filter),
        ]);

        res.json({
            candidates,
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
        });
    } catch (err) {
        next(err);
    }
}

// DELETE /api/admin/candidates/:id
export async function deleteCandidate(req, res, next) {
    try {
        const candidate = await Candidate.findByIdAndDelete(req.params.id);
        if (!candidate) return res.status(404).json({ error: "Candidate not found." });

        if (candidate.uploadedFile?.path) fs.unlink(candidate.uploadedFile.path, () => {});

        res.json({ message: "Candidate deleted.", id: req.params.id });
    } catch (err) {
        next(err);
    }
}

// GET /api/admin/stats
export async function getAdminStats(req, res, next) {
    try {
        const [totalEmployers, totalAdmins, totalCandidates, byStatus, avgSkills] = await Promise.all([
            Employer.countDocuments({ role: "employer" }),
            Employer.countDocuments({ role: "admin" }),
            Candidate.countDocuments(),
            Candidate.aggregate([{ $group: { _id: "$processingStatus", count: { $sum: 1 } } }]),
            Candidate.aggregate([
                { $project: { skillCount: { $size: { $ifNull: ["$skills", []] } } } },
                { $group: { _id: null, avg: { $avg: "$skillCount" } } },
            ]),
        ]);

        const statusMap = {};
        byStatus.forEach(({ _id, count }) => { statusMap[_id] = count; });

        res.json({
            totalEmployers,
            totalAdmins,
            totalCandidates,
            candidatesByStatus: statusMap,
            averageSkills: Math.round(avgSkills[0]?.avg || 0),
        });
    } catch (err) {
        next(err);
    }
}
