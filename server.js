// backend/server.js

const express = require("express");
const cors = require("cors");
const multer = require("multer");
require("dotenv").config();

const pdfParse = require("pdf-parse");
const Groq = require("groq-sdk");

const extractTextOCR = require("./utils/ocr");
const cleanText = require("./utils/textCleaner");

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------- GROQ CLIENT --------------------
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const MODEL_NAME = "llama-3.1-8b-instant";

// -------------------- MIDDLEWARE --------------------
app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).send("Backend running!");
});

// -------------------- FILE UPLOAD --------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// -------------------- PDF EXTRACTION --------------------
async function extractTextFromPDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text.trim();
  } catch (err) {
    console.error("PDF parse error:", err);
    return "";
  }
}

// -------------------- SUMMARIZER --------------------
async function generateStructuredSummary(text) {
  const prompt = `
You are a professional document summarizer.

IMPORTANT RULES:
- Output MUST be valid Markdown
- Use ONLY Markdown syntax
- Do NOT add explanations outside Markdown
- Do NOT wrap in code blocks

FORMAT EXACTLY LIKE THIS:

## Overview
(Write 2 short paragraphs)

## Section-wise Summary
### Section 1 Title
- Bullet point
- Bullet point

### Section 2 Title
- Bullet point
- Bullet point

## Final Key Takeaways
- Point 1
- Point 2
- Point 3
- Point 4
- Point 5

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

    // OCR fallback
    if (!text || text.length < 50) {
      console.log("📸 OCR fallback triggered");
      text = await extractTextOCR(req.file.buffer);
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
