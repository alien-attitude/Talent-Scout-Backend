/**
 * worker.js
 *
 * Registers the Bull job processor in-process with the API server.
 * Imported once by server.js — no separate process needed.
 *
 * Each job receives:
 *   { candidateId, linkedinUrl, filePath, mimeType }
 *
 * Steps:
 *   1. Fetch LinkedIn data
 *   2. Extract CV via Openai
 *   3. Merge and save to MongoDB
 */

import { cvProcessingQueue } from "../config/queue.js";
import { fetchLinkedInProfile } from "../services/linkedin.service.js";
import { extractCVData } from "../services/cv.service.js";
import { mergeProfiles } from "../services/merge.service.js";
import Candidate from "../schemas/candidate.schema.js";

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || "3");

cvProcessingQueue.process(CONCURRENCY, async (job) => {
    const { candidateId, linkedinUrl, filePath, mimeType } = job.data;

    await Candidate.findByIdAndUpdate(candidateId, { processingStatus: "processing" });
    job.progress(10);

    // Only fetch LinkedIn if a URL was provided
    let liData = {};
    if (linkedinUrl) {
        try {
            liData = await fetchLinkedInProfile(linkedinUrl);
        } catch (err) {
            console.warn(`[Worker] LinkedIn fetch failed (continuing):`, err.message);
        }
    }
    job.progress(40);

    // Only extract CV if a file was provided
    let cvData = {};
    if (filePath && mimeType) {
        try {
            cvData = await extractCVData(filePath, mimeType);
        } catch (err) {
            console.error(`[Worker] CV extraction failed:`, err.message);
            await Candidate.findByIdAndUpdate(candidateId, {
                processingStatus: "failed",
                processingError:  `CV extraction failed: ${err.message}`,
            });
            throw err;
        }
    }
    job.progress(75);

    const merged = mergeProfiles(liData, cvData);
    await Candidate.findByIdAndUpdate(candidateId, { $set: merged }, { runValidators: true });

    job.progress(100);
    return { candidateId, status: "completed" };
});

cvProcessingQueue.on("completed", (job, result) => {
    console.log(`[Queue] Job ${job.id} completed →`, result);
});

cvProcessingQueue.on("failed", (job, err) => {
    console.error(`[Queue] Job ${job.id} failed:`, err.message);
});

cvProcessingQueue.on("stalled", (job) => {
    console.warn(`[Queue] Job ${job.id} stalled — will retry`);
});

console.log(`⚙️   Worker registered (concurrency: ${CONCURRENCY})`);
