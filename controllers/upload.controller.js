import Candidate from "../schemas/candidate.schema.js";
import { cvProcessingQueue } from "../config/queue.js";
import { fetchLinkedInProfile } from "../services/linkedin.service.js";
import { extractCVData } from "../services/cv.service.js";
import { mergeProfiles } from "../services/merge.service.js";

/**
 * POST /api/employer/candidates/:id/reprocess
 *
 * Re-runs CV extraction on an existing candidate's uploaded file.
 * Useful when the initial processing failed or produced poor results.
 * Ownership is enforced — employer can only reprocess their own candidates.
 */
export async function reprocessCandidate(req, res, next) {
    try {
        // OWNERSHIP: both _id and employerId must match
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

        // Reset status so the frontend can track the new run
        await Candidate.findByIdAndUpdate(candidate._id, {
            processingStatus: "pending",
            processingError:  null,
        });

        // Try queue first — falls back to synchronous if Redis unavailable
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
                polling:     `/api/jobs/${candidate._id}/status`,
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
