import { Router } from "express";
import {
    createCandidate,
    getAllCandidates,
    getCandidatesById,
    updateCandidate,
    deleteCandidate,
    getCandidateStats,
    getCandidateJobStatus,
    reprocessCandidate,
} from "../controllers/candidate.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { handleUpload } from "../middlewares/upload.js";
import {
    validateCandidateCreate,
    validateCandidateUpdate,
    validateListQuery,
    validateObjectId,
} from "../middlewares/validators.js";

const candidateRoutes = Router();

// All candidate routes require a valid JWT cookie
candidateRoutes.use(authenticate);

// Stats
candidateRoutes.get("/stats", getCandidateStats);

// Collection
candidateRoutes.route("/")
    .get(validateListQuery, getAllCandidates)
    .post(handleUpload("cv"), validateCandidateCreate, createCandidate);

// Single candidate
candidateRoutes.route("/:id")
    .get(validateObjectId, getCandidatesById)
    .patch(validateObjectId, validateCandidateUpdate, updateCandidate)
    .delete(validateObjectId, deleteCandidate);

// Processing sub-routes
candidateRoutes.get("/:id/status",     validateObjectId, getCandidateJobStatus);
candidateRoutes.post("/:id/reprocess", validateObjectId, reprocessCandidate);

export default candidateRoutes;
