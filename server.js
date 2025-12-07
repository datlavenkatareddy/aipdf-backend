// backend/server.js

const express = require("express");
const cors = require("cors");
const multer = require("multer");
require("dotenv").config();

const pdfParse = require("pdf-parse");
const Tesseract = require("tesseract.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

// IMPORTANT: Render gives a PORT automatically
const PORT = process.env.PORT || 3000;

// Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Middlewares
app.use(cors());
app.use(express.json());

// File Upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// Extract text from PDF
async function extractTextPDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text.trim();
  } catch (err) {
    return "";
  }
}

// Fallback OCR
async function extractOCR(buffer) {
  return new Promise((resolve) => {
    Tesseract.recognize(buffer, "eng", { logger: () => {} }).then((res) => {
      resolve(res.data.text.trim());
    });
  });
}

// Summarizer
async function summarize(text) {
  const prompt = `
Summarize this text clearly using:
- 2 short paragraphs
- 5 bullet points
- Easy English

Text:
${text}
  `;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

// Main API
app.post("/api/summarize", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.json({ error: "No PDF uploaded." });

    let text = await extractTextPDF(req.file.buffer);

    if (!text || text.length < 20) text = await extractOCR(req.file.buffer);

    if (!text) return res.json({ summary: "Could not extract text." });

    const summary = await summarize(text);

    res.json({ summary });
  } catch (err) {
    res.json({ summary: "Error generating summary.", error: err.message });
  }
});

// REQUIRED — Render health check
app.get("/healthz", (req, res) => {
  res.status(200).send("OK");
});

// Start Server
app.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});
