import { createRequire } from 'module';
import fs from 'fs';
import OpenAI from 'openai';
import mammoth from 'mammoth';
import {GROQ_API_KEY} from "../config/env.js";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const client = new OpenAI({ apiKey: GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1", });

const EXTRACTION_PROMPT = `You are an expert CV parser. Extract all available candidate information from the document and return ONLY a valid JSON object with no markdown, no explanation, and no extra text.

Return exactly this shape (use empty strings/arrays when data is not found — never invent data):

{
  "fullName": "",
  "location": "",
  "email": "",
  "phone": "",
  "summary": "",
  "workExperience": [
    {
      "title": "",
      "company": "",
      "location": "",
      "startDate": "",
      "endDate": "",
      "duration": "",
      "description": "",
      "current": false
    }
  ],
  "education": [
    {
      "degree": "",
      "field": "",
      "institution": "",
      "year": "",
      "grade": ""
    }
  ],
  "skills": [],
  "certifications": []
}`;

/**
 * Extract raw text from a file buffer by MIME type.
 */
const extractText = async (buffer, mimeType) => {
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (mimeType === "application/pdf") {
    const result = await pdfParse(buffer);
    return result.text;
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
};

/**
 * Send the CV to OpenAI and receive structured JSON back.
 *
 * NOTE: This uses text-only input (no native PDF upload), relying on the
 * extracted text from the document.
 */
const callOpenAI = async (rawText) => {
  // Truncate very long CVs for safety
  const truncated = (rawText || "").slice(0, 10_000);

  const userContent = `${EXTRACTION_PROMPT}\n\nCV TEXT:\n${truncated}`;

  const response = await client.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      {
        role: "user",
        content: userContent,
      },
    ],
    max_tokens: 1500,
    temperature: 0,
  });

  const raw = response.choices?.[0]?.message?.content || "";
  const clean = raw.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(clean);
  } catch {
    throw new Error("AI returned malformed JSON. The CV may be image-only or unreadable.");
  }
};

/**
 * Main entry point: given a file path and MIME type, return structured CV data.
 */
export const extractCVData = async (filePath, mimeType) => {
  const buffer = fs.readFileSync(filePath);
  let rawText = "";

  try {
    rawText = await extractText(buffer, mimeType);
  } catch (err) {
      console.error("Error extracting text from PDF:", err);
    throw new Error("Unable to extract text from PDF. Please try again with a different file format or upload a plain text CV instead.");
  }

  const data = await callOpenAI(rawText);
  return data;
};

export default extractCVData;