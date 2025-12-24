function isHeading(line) {
    const trimmed = line.trim();
  
    if (trimmed.length < 3) return false;
  
    // 1️⃣ ALL CAPS headings
    if (trimmed === trimmed.toUpperCase() && trimmed.length <= 60) {
      return true;
    }
  
    // 2️⃣ Numbered headings (1. , 2) , 1:)
    if (/^\d+[\.\)]\s+/.test(trimmed)) {
      return true;
    }
  
    // 3️⃣ Colon headings (Subject:, Introduction:)
    if (/^[A-Z][A-Za-z\s]{2,40}:$/.test(trimmed)) {
      return true;
    }

    // OCR-style numbered headings without spaces
    if (/^\d+[A-Za-z]/.test(trimmed)) {
      return true;
    }
  
  
    return false;
  }
  
  function splitIntoSections(text) {
    const sections = [];
    let current = { title: "Overview", content: "" };
  
    const lines = text.split("\n");
  
    for (const line of lines) {
      if (isHeading(line)) {
        if (current.content.trim().length > 100) {
          sections.push(current);
        }
  
        current = {
          title: line.trim().replace(/[:]/g, ""),
          content: "",
        };
      } else {
        current.content += line + "\n";
      }
    }
  
    if (current.content.trim().length > 100) {
      sections.push(current);
    }
  
    return sections;
  }
  
  module.exports = splitIntoSections;
  