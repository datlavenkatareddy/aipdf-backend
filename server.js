// backend/server.js

const express = require("express");
const cors = require("cors");
const multer = require("multer");
require("dotenv").config();

const pdfParse = require("pdf-parse");
const Tesseract = require("tesseract.js");
const Groq = require("groq-sdk");

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------- GROQ CLIENT --------------------
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// ✅ WORKING + CURRENT MODEL
const MODEL_NAME = "llama-3.1-8b-instant";

// -------------------- MIDDLEWARE --------------------
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
  })
);
app.use(express.json());

// Root route (Render health)
app.get("/", (req, res) => {
  res.status(200).send("Backend running!");
});

// -------------------- FILE UPLOAD --------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// -------------------- PDF TEXT EXTRACTION --------------------
async function extractTextFromPDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text.trim();
  } catch (err) {
    console.error("PDF parse error:", err);
    return "";
  }
}

// -------------------- OCR FALLBACK --------------------
async function extractTextFromOCR(buffer) {
  try {
    const result = await Tesseract.recognize(buffer, "eng", {
      logger: () => {},
    });
    return result.data.text.trim();
  } catch (err) {
    console.error("OCR error:", err);
    return "";
  }
}

// -------------------- TEXT CLEANER (SAVES TOKENS) --------------------
function cleanText(text) {
  return text
    .replace(/\n{2,}/g, "\n")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000); // hard cap → avoids quota burn
}

// -------------------- SECTION-WISE SUMMARIZER --------------------
async function generateStructuredSummary(text) {
  const prompt = `
You are an expert document summarizer.

Create:
1. Overview (2 short paragraphs)
2. Section-wise summary with headings and bullet points
3. Final key takeaways (5 bullets)

Use simple, clear English.

Document Text:
${text}
  `;

  const response = await groq.chat.completions.create({
    model: MODEL_NAME,
    messages: [{ role: "user", content: prompt }],
  });

  return response.choices[0].message.content;
}

// -------------------- MAIN API --------------------
app.post("/api/summarize", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.json({ error: "No PDF uploaded." });
    }

    let text = await extractTextFromPDF(req.file.buffer);

    // 🔁 OCR fallback for scanned PDFs
    if (!text || text.length < 50) {
      console.log("Low text detected → switching to OCR");
      text = await extractTextFromOCR(req.file.buffer);
    }

    if (!text || text.length < 50) {
      return res.json({
        summary: "Unable to extract text from this PDF.",
      });
    }

    text = cleanText(text);

    const summary = await generateStructuredSummary(text);

    res.json({ summary });
  } catch (err) {
    console.error("Summarization error:", err);
    res.json({
      summary: "Error generating summary.",
      error: err.message,
    });
  }
});

// -------------------- HEALTH CHECK --------------------
app.get("/healthz", (req, res) => {
  res.status(200).send("OK");
});

// -------------------- START SERVER --------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🔥 Server running on port ${PORT}`);
});
