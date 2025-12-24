// backend/server.js

const express = require("express");
const cors = require("cors");
const multer = require("multer");
require("dotenv").config();

const pdfParse = require("pdf-parse");
const Groq = require("groq-sdk");

const extractTextOCR = require("./utils/ocr");
const cleanText = require("./utils/textCleaner");
const splitIntoSections = require("./utils/sectionSplitter");

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

app.get("/", (_, res) => {
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
    return data.text || "";
  } catch (err) {
    console.error("PDF parse error:", err);
    return "";
  }
}

// -------------------- PDF TYPE DETECTION --------------------
function detectPdfType(text) {
  return !text || text.trim().length < 300 ? "scanned" : "digital";
}

// -------------------- TEXT NORMALIZER --------------------
function normalizeTextForSections(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .split("\n")
    .map(line => line.trim())
    .join("\n");
}

// -------------------- TEXT QUALITY SCORING (CRITICAL) --------------------
function scoreTextQuality(text) {
  const length = text.trim().length;
  const words = text.split(/\s+/).length;
  const alphaChars = (text.match(/[a-zA-Z]/g) || []).length;
  const alphaRatio = alphaChars / Math.max(text.length, 1);

  if (length > 1000 && alphaRatio > 0.6) return "HIGH";
  if (length > 200 && alphaRatio > 0.4) return "MEDIUM";
  return "LOW";
}

// -------------------- MAIN API --------------------
app.post("/api/summarize", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF uploaded." });
    }

    // 1️⃣ Extract text
    let text = await extractTextFromPDF(req.file.buffer);

    // 2️⃣ Detect PDF type
    const pdfType = detectPdfType(text);

    // 3️⃣ OCR if scanned
    if (pdfType === "scanned") {
      console.log("📸 Scanned PDF detected → OCR running");
      text = await extractTextOCR(req.file.buffer);
    }

    // 4️⃣ Normalize
    const normalizedText = normalizeTextForSections(text || "");

    // 5️⃣ Split into sections
    let rawSections = splitIntoSections(normalizedText);

    console.log(
      "🧩 Detected section titles:",
      rawSections.map(s => s.title)
    );

    // 🔥 ABSOLUTE FALLBACK
    if (!Array.isArray(rawSections) || rawSections.length === 0) {
      rawSections = [
        {
          title: "Overview",
          content: normalizedText,
        },
      ];
    }

    // 6️⃣ Clean sections
    const sections = rawSections.map(sec => ({
      title: sec.title || "Overview",
      content: cleanText(sec.content || normalizedText),
    }));

    // 7️⃣ QUALITY-AWARE SUMMARIZATION 
    const summarizedSections = [];

    for (const section of sections) {
      const quality = scoreTextQuality(section.content);

      let prompt;

      if (quality === "HIGH") {
        prompt = `
Summarize the following document section clearly and concisely.
Use bullet points only.
Be specific and detailed.

Section Title: ${section.title}

Text:
${section.content}
`;
      } else if (quality === "MEDIUM") {
        prompt = `
The following text was extracted with moderate quality.
Summarize cautiously.
Do not invent details.
Use bullet points.

Text:
${section.content}
`;
      } else {
        prompt = `
You are an AI document summarizer.

The following text was extracted from a very low-quality scanned PDF.
The extracted text may be incomplete, noisy, or partially unreadable.

Your task:
- Produce the best possible summary based ONLY on the available text
- If information is insufficient, clearly state that in the summary
- Infer the general nature of the document if possible
- Do NOT ask for more input
- Do NOT invent specific details
- Use bullet points only
- Be concise and honest

Extracted Text:
${section.content || "[No readable text detected]"}
`;
      }

      const response = await groq.chat.completions.create({
        model: MODEL_NAME,
        messages: [{ role: "user", content: prompt }],
      });

      summarizedSections.push({
        title: section.title,
        summary: response.choices[0].message.content,
        confidence: quality,
      });
    }

    // 8️⃣ FINAL RESPONSE
    res.json({
      pdfType,
      sections: summarizedSections,
    });
  } catch (err) {
    console.error("Summarization error:", err);
    res.status(500).json({
      error: "Error generating summary",
      message: err.message,
    });
  }
});

// -------------------- HEALTH CHECK --------------------
app.get("/healthz", (_, res) => {
  res.status(200).send("OK");
});

// -------------------- START SERVER --------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🔥 Server running on port ${PORT}`);
});
