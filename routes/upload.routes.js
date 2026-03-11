import { Router } from "express";
import { reprocessCandidate } from "../controllers/upload.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { validateObjectId } from "../middlewares/validators.js";


const uploadRoutes = Router();

uploadRoutes.use(authenticate);

uploadRoutes.post("/:id/reprocess", validateObjectId, reprocessCandidate);

export default uploadRoutes;
