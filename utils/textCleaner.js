function cleanText(text) {
    return text
      // normalize multiple blank lines
      .replace(/\n{3,}/g, "\n\n")
  
      // remove extra spaces BUT KEEP line breaks
      .replace(/[ \t]+/g, " ")
  
      // trim each line
      .split("\n")
      .map(line => line.trim())
      .join("\n")
  
      .trim()
      .slice(0, 12000); // token safety
  }
  
  module.exports = cleanText;
  