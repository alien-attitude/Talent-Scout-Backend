import { Router } from "express";
import {
    getAllEmployers,
    createEmployer,
    updateEmployer,
    deleteEmployer,
    getAllCandidates,
    deleteCandidate,
    getAdminStats,
} from "../controllers/admin.controller.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { validateObjectId, validateAdminCreateEmployer } from "../middlewares/validators.js";

const adminRoutes = Router();

/**
 * Every admin route requires:
 *   1. authenticate — valid JWT cookie
 *   2. authorize("admin") — role must be "admin"
 *
 * Applying both as adminRoutes-level middleware means every route
 * below is automatically protected — we never forget to add it.
 */
adminRoutes.use(authenticate, authorize("admin"));

//  Dashboard stats
adminRoutes.get("/stats", getAdminStats);

// Employer management
adminRoutes.route("/employers")
    .get(getAllEmployers)
    .post(validateAdminCreateEmployer, createEmployer);

adminRoutes.route("/employers/:id")
    .patch(validateObjectId, updateEmployer)
    .delete(validateObjectId, deleteEmployer);

//  Candidate oversight
adminRoutes.get("/candidates", getAllCandidates);
adminRoutes.delete("/candidates/:id", validateObjectId, deleteCandidate);

export default adminRoutes;
