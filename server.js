// backend/server.js

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const Tesseract = require("tesseract.js");
require("dotenv").config();

const { GoogleGenerativeAI } = require("@google/generative-ai");

// -----------------------------
// EXPRESS APP
// -----------------------------
const app = express();

// Render provides PORT → use it
const PORT = process.env.PORT || 5050;

// Middleware
app.use(cors());
app.use(express.json());

// -----------------------------
// HEALTH CHECK (IMPORTANT FOR RENDER)
// -----------------------------
app.get("/healthz", (req, res) => {
  res.status(200).send("OK");
});

// -----------------------------
// FILE UPLOAD (Memory Storage)
// -----------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// -----------------------------
// GEMINI MODEL INIT
// -----------------------------
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// -----------------------------
// TEXT EXTRACTION FROM PDF
// -----------------------------
async function extractTextPDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text.trim();
  } catch (err) {
    return "";
  }
}

// -----------------------------
// FALLBACK: IMAGE-BASED OCR
// -----------------------------
async function extractOCR(buffer) {
  try {
    const result = await Tesseract.recognize(buffer, "eng", {
      logger: () => {},
    });
    return result.data.text.trim();
  } catch (err) {
    return "";
  }
}

// -----------------------------
// SUMMARIZE USING GEMINI PRO
// -----------------------------
async function summarizeWithGemini(text) {
  const prompt = `
Summarize the following document in simple English.

Output format:
1. Two short paragraphs  
2. Then 5–7 bullet points  
3. Clear and easy to understand  

Text:
${text}
  `;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

// -----------------------------
// MAIN API ROUTE
// -----------------------------
app.post("/api/summarize", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.json({ error: "No PDF uploaded." });
    }

    // Step 1: Try extracting real text
    let text = await extractTextPDF(req.file.buffer);

    // Step 2: If no text, use OCR
    if (!text || text.length < 20) {
      text = await extractOCR(req.file.buffer);
    }

    if (!text || text.length < 10) {
      return res.json({ summary: "Could not extract text from PDF." });
    }

    // Step 3: Summarize
    const summary = await summarizeWithGemini(text);

    return res.json({ summary });
  } catch (err) {
    return res.json({
      summary: "Summary could not be generated.",
      error: err.message,
    });
  }
});

// -----------------------------
// START SERVER
// -----------------------------
app.listen(PORT, () => {
  console.log(`🔥 Backend running on http://localhost:${PORT}`);
});
