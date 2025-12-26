// backend/utils/ocr.js

async function extractTextOCR(buffer) {
    return {
      text: "",
      ocrQuality: { score: 0, reason: "ocr_disabled" },
    };
  }
  
  module.exports = extractTextOCR;
  