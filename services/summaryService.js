const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const MODEL = "llama-3.1-8b-instant"; // current working model

async function generateSectionSummary(text) {
  const prompt = `
You are an expert document summarizer.

Task:
1. Identify logical sections in the document.
2. Generate:
   - Overview (2 short paragraphs)
   - Section-wise bullet summary
   - Final key takeaways (5 bullets)

Text:
${text}
  `;

  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }]
  });

  return response.choices[0].message.content;
}

module.exports = { generateSectionSummary };
