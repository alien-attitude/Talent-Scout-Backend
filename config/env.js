import { config } from "dotenv";

if (process.env.NODE_ENV !== "production") {
    config({ path: `.env.${process.env.NODE_ENV || "development"}.local` });
}

export const {
    PORT,
    NODE_ENV,
    DB_URI,
    SERVER_URL,
    ACCESS_TOKEN_SECRET, ACCESS_TOKEN_EXPIRES_IN ,
    REFRESH_TOKEN_SECRET, REFRESH_TOKEN_EXPIRES_IN,
    GROQ_API_KEY,
    ADMIN_EMAIL, ADMIN_PASSWORD
} = process.env