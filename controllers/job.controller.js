import Candidate from "../schemas/candidate.schema.js";
import { cvProcessingQueue } from "../config/queue.js";

/**
 * GET /api/jobs/:id/status
 *
 * Polls the processing status of a candidate submission.
 * Ownership is enforced — employer can only poll their own candidates.
 * Returns job queue progress + full candidate data once processing is complete.
 */
export async function getJobStatus(req, res, next) {
    try {
        // OWNERSHIP: scope to the authenticated employer's candidates only
        const candidate = await Candidate.findOne({
            _id:        req.params.id,
            employerId: req.employer._id,
        })
            .select("fullName processingStatus processingError jobId sources createdAt")
            .lean();

        if (!candidate) {
            return res.status(404).json({ error: "Candidate not found." });
        }

        // Attempt to get live progress from the Bull queue
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
            // Only return full candidate data once processing is done
            candidate:   candidate.processingStatus === "completed" ? candidate : null,
        });
    } catch (err) {
        next(err);
    }
}
