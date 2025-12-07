// backend/server.js

const express = require("express");
const cors = require("cors");
const multer = require("multer");
require("dotenv").config();

const pdfParse = require("pdf-parse");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

// Render will assign PORT automatically
const PORT = process.env.PORT || 3000;

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ✔️ USE A SAFE MODEL THAT YOUR API KEY SUPPORTS
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// Middlewares
app.use(cors());
app.use(express.json());

// Required endpoint for Render
app.get("/", (req, res) => {
  res.status(200).send("Backend is running!");
});

// File upload settings
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
    console.error("PDF parse error:", err);
    return "";
  }
}

// Summarizer using Gemini
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

// Main summarize endpoint
app.post("/api/summarize", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.json({ error: "No PDF uploaded." });
    }

    let text = await extractTextPDF(req.file.buffer);

    if (!text || text.length < 20) {
      return res.json({ summary: "PDF text could not be extracted." });
    }

    const summary = await summarize(text);

    res.json({ summary });
  } catch (err) {
    console.error("Error:", err);
    res.json({
      summary: "Error generating summary.",
      error: err.message,
    });
  }
});

// Health check for Render
app.get("/healthz", (req, res) => {
  res.status(200).send("OK");
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🔥 Server running on port ${PORT}`);
});
