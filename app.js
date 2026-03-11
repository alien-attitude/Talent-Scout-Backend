import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";
import rateLimit  from "express-rate-limit";
import {fileURLToPath} from "url";
import path from "path";



import authRoutes  from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import employerRoutes from "./routes/employer.routes.js";
import candidateRoutes from "./routes/candidate.routes.js";
import errorHandler from "./middlewares/errorHandler.js";
import notFound from "./middlewares/notFound.js";
import {fetchLinkedInProfile} from "./services/linkedin.service.js";


const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line no-unused-vars
const __dirname  = path.dirname(__filename);

const app = express();

// Security
app.use(helmet());
app.use(
    cors({
        origin: process.env.CLIENT_URL || "http://localhost:5173",
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    })
);

// Rate Limiting
app.use( "/api/v1",
    rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 200,
        message: { error: "Too many requests, please try again later." },
    })
);

// Submission endpoint rate limit (stricter)
app.use(
    "/api/v1/candidates",
    rateLimit({
        windowMs: 60 * 60 * 1000,
        max: 30,
        skip: (req) => req.method !== "POST",
    })
);

app.use(
    "/uploads",
    express.static(
        path.resolve(process.env.UPLOAD_DIR || "./uploads")
    )
);

app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post('/linkedin', async (req, res) => {
    const { url } = req.body;
    try {
        const profile = await fetchLinkedInProfile(url);
        res.json(profile);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.use(express.json({limit: "10mb"}));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

//  API Routes
app.use("/api/v1/auth",       authRoutes);       // POST /signup  /login  /logout  GET /me
app.use("/api/v1/employer",   employerRoutes);   // GET/PATCH /profile PATCH /change-password
app.use("/api/v1/candidates", candidateRoutes);  // full CRUD + /status + /reprocess
app.use("/api/v1/admin",      adminRoutes);      // admin-only employer & candidate management

app.get("/", (req, res) => {
    res.send("Welcome to Talent Scout")
})

// 404 & Global Error Handler
app.use(notFound);
app.use(errorHandler);


export default app;