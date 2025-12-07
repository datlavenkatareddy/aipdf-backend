// backend/server.js

const express = require("express");
const cors = require("cors");
const multer = require("multer");
require("dotenv").config();

const pdfParse = require("pdf-parse");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------- GEMINI SETUP --------------------
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// WORKING MODEL FOR v1beta API
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// -------------------- MIDDLEWARE --------------------
app.use(cors());
app.use(express.json());

// Required by Render root route
app.get("/", (req, res) => {
  res.status(200).send("Backend is running!");
});

// -------------------- FILE UPLOAD --------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// -------------------- PDF TEXT EXTRACTOR --------------------
async function extractTextPDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text.trim();
  } catch (err) {
    console.error("PDF parse error:", err);
    return "";
  }
}

// -------------------- SUMMARIZER --------------------
async function summarize(text) {
  const prompt = `
Summarize the following text into:
- Two short paragraphs
- Five bullet points
- Use simple, easy English

Text:
${text}
  `;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

// -------------------- MAIN API --------------------
app.post("/api/summarize", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.json({ error: "No PDF uploaded." });

    let text = await extractTextPDF(req.file.buffer);

    if (!text || text.length < 20) {
      return res.json({
        summary: "Could not extract text. (OCR is disabled on Render.)",
      });
    }

    const summary = await summarize(text);

    res.json({ summary });
  } catch (err) {
    console.error("Summary error:", err);
    res.json({
      summary: "Error generating summary.",
      error: err.message,
    });
  }
});

// -------------------- HEALTH CHECK (REQUIRED BY RENDER) --------------------
app.get("/healthz", (req, res) => {
  res.status(200).send("OK");
});

// -------------------- START SERVER --------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🔥 Server running on port ${PORT}`);
});
