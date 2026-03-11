import { Router } from "express";
import { getJobStatus } from "../controllers/job.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { validateObjectId } from "../middlewares/validators.js";

const jobRoutes = Router();

jobRoutes.use(authenticate);

jobRoutes.get("/:id/status", validateObjectId, getJobStatus);

export default jobRoutes;
