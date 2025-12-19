function cleanText(text) {
    return text
      .replace(/\n{2,}/g, "\n")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 12000); // hard limit → saves tokens
  }
  
  module.exports = cleanText ;
  