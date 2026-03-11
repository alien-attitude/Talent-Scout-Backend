import { Router } from "express";
import {
    getProfile,
    updateProfile,
    changePassword,
} from "../controllers/employer.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const employerRoutes = Router();

// All employer profile routes require a valid JWT cookie
employerRoutes.use(authenticate);

employerRoutes.get("/profile",         getProfile);
employerRoutes.patch("/profile",       updateProfile);
employerRoutes.patch("/change-password", changePassword);

export default employerRoutes;
