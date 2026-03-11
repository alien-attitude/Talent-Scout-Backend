import fs from "fs";
import Candidate from "../schemas/candidate.schema.js";
import { cvProcessingQueue } from "../config/queue.js";
import { fetchLinkedInProfile } from "../services/linkedin.service.js";
import { extractCVData } from "../services/cv.service.js";
import { mergeProfiles } from "../services/merge.service.js";

/**
 * candidateController.js
 *
 * Handles all candidate operations for an authenticated employer.
 * Every function scopes its DB query to req.employer._id so employers
 * can never read or modify candidates that belong to another employer.
 */

//  POST /api/candidates
export const createCandidate = async (req, res, next) => {
    const { linkedinUrl } = req.body;
    const file = req.file;

    // "At least one" check — multer has already run by this point
    // so req.file is guaranteed to be populated if a file was sent
    if (!linkedinUrl?.trim() && !file) {
        return res.status(400).json({
            error: "Please provide either a LinkedIn URL or a CV file.",
            code:  "MISSING_INPUT",
        });
    }

    try {
        const candidate = await Candidate.create({
            employerId:  req.employer._id,
            fullName:    "Processing…",
            linkedinUrl: linkedinUrl || "",
            ...(file && {
                uploadedFile: {
                    originalName: file.originalname,
                    storedName:   file.filename,
                    mimeType:     file.mimetype,
                    sizeBytes:    file.size,
                    path:         file.path,
                },
            }),
            processingStatus: "pending",
        });

        try {
            const job = await cvProcessingQueue.add(
                {
                    candidateId:  candidate._id.toString(),
                    employerId:   req.employer._id.toString(),
                    linkedinUrl:  linkedinUrl || null,   // null if not provided
                    filePath:     file?.path || null,    // null if no file
                    mimeType:     file?.mimetype || null,
                },
                {
                    attempts:         3,
                    backoff:          { type: "exponential", delay: 2000 },
                    removeOnComplete: 50,
                    removeOnFail:     20,
                }
            );

            await Candidate.findByIdAndUpdate(candidate._id, { jobId: job.id.toString() });

            return res.status(202).json({
                message:     "Candidate submission received. Processing in background.",
                candidateId: candidate._id,
                jobId:       job.id,
                status:      "pending",
                polling:     `/api/candidates/${candidate._id}/status`,
            });
        } catch (queueErr) {
            console.warn("Queue unavailable, falling back to synchronous processing:", queueErr.message);

            await Candidate.findByIdAndUpdate(candidate._id, { processingStatus: "processing" });

            // Run only what was provided
            const [liResult, cvResult] = await Promise.allSettled([
                linkedinUrl ? fetchLinkedInProfile(linkedinUrl) : Promise.resolve({}),
                file        ? extractCVData(file.path, file.mimetype) : Promise.resolve({}),
            ]);

            const merged = mergeProfiles(
                liResult.status === "fulfilled" ? liResult.value : {},
                cvResult.status === "fulfilled" ? cvResult.value : {}
            );

            const updated = await Candidate.findByIdAndUpdate(
                candidate._id,
                { $set: merged },
                { new: true, runValidators: true }
            );

            return res.status(201).json({
                message:   "Candidate profile created successfully.",
                candidate: updated,
            });
        }
    } catch (err) {
        if (req.file?.path) fs.unlink(req.file.path, () => {});
        next(err);
    }
};

// GET /api/candidates
export async function getAllCandidates(req, res, next) {
    try {
        const page   = Math.max(1, parseInt(req.query.page)  || 1);
        const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip   = (page - 1) * limit;
        const sortBy = req.query.sortBy || "createdAt";
        const order  = req.query.order === "asc" ? 1 : -1;
        const search = req.query.search?.trim();
        const status = req.query.status;

        // Ownership — always filter by the logged-in employer's ID
        const filter = { employerId: req.employer._id };

        if (status) filter.processingStatus = status;
        if (search) {
            filter.$or = [
                { fullName: { $regex: search, $options: "i" } },
                { headline: { $regex: search, $options: "i" } },
                { skills:   { $elemMatch: { $regex: search, $options: "i" } } },
                { location: { $regex: search, $options: "i" } },
            ];
        }

        const [candidates, total] = await Promise.all([
            Candidate.find(filter)
                .select("-rawLinkedinData -rawCvData -uploadedFile")
                .sort({ [sortBy]: order })
                .skip(skip)
                .limit(limit)
                .lean(),
            Candidate.countDocuments(filter),
        ]);

        res.json({
            candidates,
            pagination: {
                total,
                page,
                limit,
                pages:   Math.ceil(total / limit),
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1,
            },
        });
    } catch (err) {
        next(err);
    }
}

// GET /api/candidates/:id
export async function getCandidatesById(req, res, next) {
    try {
        const candidate = await Candidate.findOne({
            _id:        req.params.id,
            employerId: req.employer._id,
        }).lean();

        if (!candidate) {
            return res.status(404).json({ error: "Candidate not found." });
        }

        res.json({ candidate });
    } catch (err) {
        next(err);
    }
}

// PATCH /api/candidates/:id
export async function updateCandidate(req, res, next) {
    try {
        const ALLOWED_FIELDS = [
            "fullName", "headline", "summary", "location",
            "email", "phone", "skills", "certifications",
            "portfolioLinks", "workExperience", "education",
        ];

        const updates = {};
        for (const key of ALLOWED_FIELDS) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: "No valid fields to update." });
        }

        const candidate = await Candidate.findOneAndUpdate(
            { _id: req.params.id, employerId: req.employer._id },
            { $set: updates },
            { new: true, runValidators: true }
        ).lean();

        if (!candidate) {
            return res.status(404).json({ error: "Candidate not found." });
        }

        res.json({ message: "Candidate updated.", candidate });
    } catch (err) {
        next(err);
    }
}

// DELETE /api/candidates/:id
export async function deleteCandidate(req, res, next) {
    try {
        const candidate = await Candidate.findOneAndDelete({
            _id:        req.params.id,
            employerId: req.employer._id,
        });

        if (!candidate) {
            return res.status(404).json({ error: "Candidate not found." });
        }

        if (candidate.uploadedFile?.path) fs.unlink(candidate.uploadedFile.path, () => {});

        res.json({ message: "Candidate deleted successfully.", id: req.params.id });
    } catch (err) {
        next(err);
    }
}

// GET /api/candidates/stats
export async function getCandidateStats(req, res, next) {
    try {
        const scope = { employerId: req.employer._id };

        const [total, byStatus, withLinkedin, withCV, avgSkills] = await Promise.all([
            Candidate.countDocuments(scope),
            Candidate.aggregate([
                { $match: scope },
                { $group: { _id: "$processingStatus", count: { $sum: 1 } } },
            ]),
            Candidate.countDocuments({ ...scope, "sources.linkedin": true }),
            Candidate.countDocuments({ ...scope, "sources.cv": true }),
            Candidate.aggregate([
                { $match: scope },
                { $project: { skillCount: { $size: { $ifNull: ["$skills", []] } } } },
                { $group: { _id: null, avg: { $avg: "$skillCount" } } },
            ]),
        ]);

        const statusMap = {};
        byStatus.forEach(({ _id, count }) => { statusMap[_id] = count; });

        res.json({
            total,
            byStatus: statusMap,
            withLinkedin,
            withCV,
            averageSkills: Math.round(avgSkills[0]?.avg || 0),
        });
    } catch (err) {
        next(err);
    }
}

//GET /api/candidates/:id/status
export async function getCandidateJobStatus(req, res, next) {
    try {
        const candidate = await Candidate.findOne({
            _id:        req.params.id,
            employerId: req.employer._id,
        })
            .select("fullName processingStatus processingError jobId sources createdAt")
            .lean();

        if (!candidate) {
            return res.status(404).json({ error: "Candidate not found." });
        }

        let jobProgress = null;
        if (candidate.jobId) {
            try {
                const job = await cvProcessingQueue.getJob(candidate.jobId);
                if (job) {
                    const state = await job.getState();
                    jobProgress = { state, progress: job.progress() };
                }
            } catch {
                // Queue unavailable — processingStatus on the candidate is the fallback
            }
        }

        res.json({
            candidateId: candidate._id,
            status:      candidate.processingStatus,
            error:       candidate.processingError,
            progress:    jobProgress,
            ready:       candidate.processingStatus === "completed",
            candidate:   candidate.processingStatus === "completed" ? candidate : null,
        });
    } catch (err) {
        next(err);
    }
}

//  POST /api/candidates/:id/reprocess
export async function reprocessCandidate(req, res, next) {
    try {
        const candidate = await Candidate.findOne({
            _id:        req.params.id,
            employerId: req.employer._id,
        });

        if (!candidate) {
            return res.status(404).json({ error: "Candidate not found." });
        }

        const file = candidate.uploadedFile;
        if (!file?.path) {
            return res.status(400).json({
                error: "No uploaded file found for this candidate.",
                code:  "NO_FILE",
            });
        }

        await Candidate.findByIdAndUpdate(candidate._id, {
            processingStatus: "pending",
            processingError:  null,
        });

        try {
            const job = await cvProcessingQueue.add({
                candidateId: candidate._id.toString(),
                employerId:  req.employer._id.toString(),
                linkedinUrl: candidate.linkedinUrl,
                filePath:    file.path,
                mimeType:    file.mimeType,
            });

            await Candidate.findByIdAndUpdate(candidate._id, { jobId: job.id.toString() });

            return res.status(202).json({
                message:     "Reprocessing queued.",
                jobId:       job.id,
                candidateId: candidate._id,
                polling:     `/api/candidates/${candidate._id}/status`,
            });
        } catch {
            // Fallback: synchronous inline processing
            const [liData, cvData] = await Promise.allSettled([
                fetchLinkedInProfile(candidate.linkedinUrl),
                extractCVData(file.path, file.mimeType),
            ]);

            const merged = mergeProfiles(
                liData.status === "fulfilled" ? liData.value : {},
                cvData.status === "fulfilled" ? cvData.value : {}
            );

            const updated = await Candidate.findByIdAndUpdate(
                candidate._id,
                { $set: merged },
                { new: true }
            );

            return res.json({ message: "Reprocessed successfully.", candidate: updated });
        }
    } catch (err) {
        next(err);
    }
}