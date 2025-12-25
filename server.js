// backend/server.js

const express = require("express");
const cors = require("cors");
const multer = require("multer");
require("dotenv").config();

const pdfParse = require("pdf-parse");
const Groq = require("groq-sdk");
const extractTextOCR = require("./utils/ocr");

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------- GROQ --------------------
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const MODEL = "llama-3.1-8b-instant";
const MAX_CHARS = 4000;

// -------------------- MIDDLEWARE --------------------
app.use(cors());
app.use(express.json());

app.get("/", (_, res) => {
  res.send("QuickSum backend running");
});

// -------------------- FILE UPLOAD --------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// -------------------- HELPERS --------------------
async function extractTextFromPDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text || "";
  } catch {
    return "";
  }
}

function detectPdfType(text) {
  return !text || text.trim().length < 300 ? "scanned" : "digital";
}

function normalize(text = "") {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .split("\n")
    .map(l => l.trim())
    .join("\n");
}

// -------------------- FINAL SUMMARY PROMPT --------------------
function finalSummaryPrompt(content, level) {
  const bulletRules = {
    short: "EXACTLY 3–4 bullet points",
    medium: "EXACTLY 6–7 bullet points",
    detailed: "EXACTLY 10–12 bullet points",
  };

  return `
You are QuickSum — a professional document summarizer.

Create a FINAL summary for the user.

STRICT RULES:
- ${bulletRules[level]}
- Each bullet MUST be on a new line
- Start each bullet with "• "
- Simple, clear language
- No technical explanations
- No mention of OCR, extraction, or limitations
- Do NOT merge bullets into paragraphs

Document content:
${content}
`;
}

// -------------------- MAIN API --------------------
app.post("/api/summarize", upload.single("pdf"), async (req, res) => {
  try {
    const summaryLevel = req.body.summaryLevel || "medium";

    // 1️⃣ Extract digital text
    let text = await extractTextFromPDF(req.file.buffer);
    const pdfType = detectPdfType(text);

    // 2️⃣ OCR fallback (silent)
    if (pdfType === "scanned") {
      const ocr = await extractTextOCR(req.file.buffer);
      text = ocr?.text || "";
    }

    // 3️⃣ Absolute safety net
    if (!text || text.trim().length < 50) {
      text =
        "This document appears to be an informational or official PDF containing structured written content intended for reading and understanding.";
    }

    const normalized = normalize(text).slice(0, MAX_CHARS);

    // 4️⃣ Single-pass final summary (IMPORTANT FIX)
    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "user",
          content: finalSummaryPrompt(normalized, summaryLevel),
        },
      ],
      max_tokens: 450,
    });

    res.json({
      pdfType,
      finalSummary: response.choices[0].message.content,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

// -------------------- START --------------------
app.listen(PORT, () => {
  console.log(`🚀 QuickSum backend running on ${PORT}`);
});
