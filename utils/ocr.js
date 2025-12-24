// utils/ocr.js

const { fromBuffer } = require("pdf2image");
const Tesseract = require("tesseract.js");

async function extractTextOCR(pdfBuffer) {
  try {
    const converter = fromBuffer(pdfBuffer, {
      density: 200,
      format: "png",
      width: 1654,
      height: 2339,
    });

    const pages = await converter.bulk(-1, true);

    let fullText = "";

    for (const page of pages) {
      const {
        data: { text },
      } = await Tesseract.recognize(page.buffer, "eng");

      fullText += text + "\n";
    }

    return fullText.trim();
  } catch (err) {
    console.error("OCR error:", err);
    return "";
  }
}

module.exports = extractTextOCR;
