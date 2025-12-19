const Tesseract = require("tesseract.js");

async function extractTextOCR(buffer) {
  try {
    const result = await Tesseract.recognize(buffer, "eng", {
      logger: () => {}
    });
    return result.data.text.trim();
  } catch (err) {
    console.error("OCR error:", err);
    return "";
  }
}

module.exports = { extractTextOCR };
