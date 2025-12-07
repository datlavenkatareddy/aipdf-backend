// backend/server.js
const express = require("express");
const cors = require("cors");
const multer = require("multer");
require("dotenv").config();

const pdfParse = require("pdf-parse");
const Tesseract = require("tesseract.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 5050;

// Gemini Init
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// Middleware
app.use(cors());
app.use(express.json());

// Health check route (REQUIRED FOR RENDER)
app.get("/healthz", (req, res) => {
  res.status(200).send("OK");
});

// Multer memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// PDF text extraction
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
async function summarizeWithGemini(text) {
  const prompt = `
Summarize the following text clearly using:
- 2 short paragraphs
- 5–7 bullet points
- Simple English

Text:
${text}
  `;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

// Main route
app.post("/api/summarize", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.json({ error: "No PDF uploaded." });

    let text = await extractTextPDF(req.file.buffer);

    if (!text || text.length < 30) {
      text = await extractOCR(req.file.buffer);
    }

    if (!text || text.length < 10) {
      return res.json({ summary: "Could not extract text from PDF." });
    }

    const summary = await summarizeWithGemini(text);
    return res.json({ summary });

  } catch (e) {
    return res.json({ summary: "Summary could not be generated.", error: e.toString() });
  }
});

// Start server — MUST LISTEN ON 0.0.0.0 FOR RENDER
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🔥 Backend running on port ${PORT}`);
});
