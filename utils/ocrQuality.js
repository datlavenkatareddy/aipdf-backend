// utils/ocrQuality.js

function scoreOCR(text) {
    if (!text || text.trim().length === 0) {
      return {
        score: 0,
        reason: "empty_text"
      };
    }
  
    const length = text.length;
  
    const alphaCount = (text.match(/[a-zA-Z]/g) || []).length;
    const digitCount = (text.match(/[0-9]/g) || []).length;
    const garbageCount = (text.match(/[^a-zA-Z0-9\s.,;:()\-]/g) || []).length;
  
    const alphaRatio = alphaCount / length;
    const garbageRatio = garbageCount / length;
  
    let score = 0;
  
    if (length > 500) score += 0.35;
    if (alphaRatio > 0.6) score += 0.45;
    if (garbageRatio < 0.12) score += 0.20;
  
    return {
      score: Number(score.toFixed(2)),
      metrics: {
        length,
        alphaRatio: Number(alphaRatio.toFixed(2)),
        garbageRatio: Number(garbageRatio.toFixed(2))
      }
    };
  }
  
  module.exports = { scoreOCR };
  