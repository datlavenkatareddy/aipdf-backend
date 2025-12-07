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

// Gemini Init with NEW working model
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "models/gemini-2.5-flash",
});

// Middleware
app.use(cors());
app.use(express.json());

// Multer storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// PDF extraction
async function extractTextPDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text.trim();
  } catch (err) {
    return "";
  }
}

// OCR fallback
async function extractOCR(buffer) {
  try {
    const result = await Tesseract.recognize(buffer, "eng");
    return result.data.text.trim();
  } catch (err) {
    return "";
  }
}

// Summarize with Gemini 2.5 Flash
async function summarize(text) {
  const prompt = `
Summarize the following text clearly with:
- 2 paragraphs
- Bullet points
- Simple English
- Meaning preserved

TEXT:
${text}
`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

// Route
app.post("/api/summarize", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.json({ error: "No PDF uploaded" });

    let text = await extractTextPDF(req.file.buffer);

    if (!text || text.length < 20) {
      text = await extractOCR(req.file.buffer);
    }

    if (!text || text.length < 10) {
      return res.json({ summary: "Could not extract text from PDF." });
    }

    const summary = await summarize(text);

    res.json({ summary });
  } catch (err) {
    res.json({
      summary: "Summary could not be generated.",
      error: err.toString(),
    });
  }
});

app.listen(PORT, () =>
  console.log(`🔥 Backend running on http://localhost:${PORT}`)
);
