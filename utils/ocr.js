const Tesseract = require("tesseract.js");

async function extractTextOCR(buffer) {
  try {
    const { data } = await Tesseract.recognize(buffer, "eng", {
      logger: m => console.log(m.status),
    });

    return data.text.trim();
  } catch (err) {
    console.error("OCR error:", err);
    return "";
  }
}

module.exports = extractTextOCR;
