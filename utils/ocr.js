// utils/ocr.js

const { fromBuffer } = require("pdf2image");
const Tesseract = require("tesseract.js");
const sharp = require("sharp");

function scoreText(text) {
  const length = text.trim().length;
  const alpha = (text.match(/[a-zA-Z]/g) || []).length;
  const ratio = alpha / Math.max(text.length, 1);

  return length * ratio;
}

async function preprocess(buffer, mode) {
  let img = sharp(buffer).grayscale();

  if (mode === "threshold") {
    img = img.threshold(160);
  }

  if (mode === "invert") {
    img = img.negate();
  }

  return img.png().toBuffer();
}

async function ocrImage(imageBuffer) {
  const {
    data: { text },
  } = await Tesseract.recognize(imageBuffer, "eng", {
    tessedit_pageseg_mode: 6,
  });
  return text || "";
}

async function extractTextOCR(pdfBuffer) {
  try {
    const converter = fromBuffer(pdfBuffer, {
      density: 300,
      format: "png",
    });

    const pages = await converter.bulk(-1, true);

    let bestText = "";
    let bestScore = 0;

    for (const page of pages) {
      const original = page.buffer;

      const variants = [
        original,
        await preprocess(original, "threshold"),
        await preprocess(original, "invert"),
      ];

      for (const variant of variants) {
        const text = await ocrImage(variant);
        const score = scoreText(text);

        if (score > bestScore) {
          bestScore = score;
          bestText = text;
        }
      }
    }

    if (bestScore < 50) {
      return {
        text: "",
        ocrQuality: { score: 0, reason: "unreadable_scan" },
      };
    }

    return {
      text: bestText.trim(),
      ocrQuality: { score: bestScore, reason: "enhanced_ocr" },
    };
  } catch (err) {
    console.error("OCR error:", err);
    return {
      text: "",
      ocrQuality: { score: 0, reason: "ocr_exception" },
    };
  }
}

module.exports = extractTextOCR;
