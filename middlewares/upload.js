import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line no-unused-vars
const __dirname = path.dirname(__filename);

const ALLOWED_TYPES = {
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

const MAX_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || "5");

// Use UPLOAD_DIR env var if set, otherwise fall back to a subfolder
// inside the OS temp directory — always writable on any platform
export const UPLOAD_DIR = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(os.tmpdir(), "cpa-uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const ext = ALLOWED_TYPES[file.mimetype] || path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
    },
});

const fileFilter = (_req, file, cb) => {
    if (ALLOWED_TYPES[file.mimetype]) {
        cb(null, true);
    } else {
        cb(
            Object.assign(new Error("Only PDF, DOC, and DOCX files are allowed."), {
                code: "INVALID_FILE_TYPE",
                status: 400,
            }),
            false
        );
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
});

export function handleUpload(fieldName) {
    return (req, res, next) => {
        upload.single(fieldName)(req, res, (err) => {
            if (!err) return next();
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({
                    error: `File size must not exceed ${MAX_SIZE_MB} MB.`,
                    code: "FILE_TOO_LARGE",
                });
            }
            if (err.code === "INVALID_FILE_TYPE") {
                return res.status(400).json({ error: err.message, code: err.code });
            }
            next(err);
        });
    };
}
