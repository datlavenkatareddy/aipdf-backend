// backend/server.js

const express = require("express");
const cors = require("cors");
const multer = require("multer");
require("dotenv").config();

const pdfParse = require("pdf-parse");
const Groq = require("groq-sdk");

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------- GROQ CLIENT --------------------
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// WORKING MODEL (old model was removed)
const MODEL_NAME = "llama-3.1-8b-instant";


// -------------------- MIDDLEWARE --------------------
app.use(cors());
app.use(express.json());

// Root route for Render
app.get("/", (req, res) => {
  res.status(200).send("Backend running!");
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
    console.error("PDF parsing error:", err);
    return "";
  }
}

// -------------------- SUMMARIZER --------------------
async function summarize(text) {
  const prompt = `
Summarize the following text clearly:
- Two short paragraphs
- Five bullet points
- Simple English

Text:
${text}
  `;

  const response = await groq.chat.completions.create({
    model: MODEL_NAME,
    messages: [
      {
        role: "user",
        content: prompt
      }
    ]
  });

  return response.choices[0].message.content;
}

// -------------------- MAIN API --------------------
app.post("/api/summarize", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.json({ error: "No PDF uploaded." });

    let text = await extractTextPDF(req.file.buffer);

    if (!text || text.length < 20) {
      return res.json({
        summary: "Could not extract text from PDF (OCR disabled)."
      });
    }

    const summary = await summarize(text);

    res.json({ summary });

  } catch (err) {
    console.error("Summary error:", err);
    res.json({
      summary: "Error generating summary.",
      error: err.message
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
