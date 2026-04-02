const { GoogleGenAI } = require("@google/genai");
require("dotenv").config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function generateQuestion(language, difficulty) {
  const difficultyGuide = {
    easy: "Basic syntax only: printing a string, declaring a variable, simple output. No math, no logic, no functions.",
    medium: "Simple arithmetic: write a function that adds, subtracts, multiplies or divides two numbers and prints the result.",
    hard: "Algorithms: find the minimum or maximum in a list, count occurrences, or reverse a string using loops."
  };

  const prompt = `You are a coding challenge generator.
Generate a ${language} coding challenge at ${difficulty} difficulty.

Difficulty rule: ${difficultyGuide[difficulty] || difficultyGuide.easy}

Respond ONLY with JSON in this format:
{
  "prompt": "the challenge description",
  "topic": "topic name",
  "expectedOutput": "what the code should output",
  "sampleSolution": "the correct code"
}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  const text = response.text;
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

async function checkCode(playerCode, question, language) {
  const prompt = `Simulate running this ${language} code. Reply with ONLY the exact text it would print to stdout — nothing else, no explanation.

Code:
${playerCode}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  const predicted = response.text.trim();
  const expected = question.expectedOutput.trim();

  const correct = predicted === expected ||
    predicted.replace(/['"]/g, '') === expected.replace(/['"]/g, '') ||
    predicted.toLowerCase() === expected.toLowerCase();

  return {
    correct,
    partialScore: correct ? 100 : 0,
    feedback: correct
      ? "Great job! Your code produces the correct output."
      : `Your code prints "${predicted}" but the expected output is "${expected}".`,
    hint: correct ? "" : `Expected output: ${expected}`
  };
}

async function generateMatchFeedback(winnerCode, loserCode, question) {
  const prompt = `You are a coding mentor.
The challenge was: "${question.prompt}"
Winner's code: ${winnerCode}
Loser's code: ${loserCode}

Respond ONLY with JSON in this format:
{
  "winnerNote": "two sentences praising the winner",
  "loserNote": "two sentences encouraging the loser",
  "keyLesson": "one sentence takeaway for both players"
}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  const text = response.text;
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

module.exports = { generateQuestion, checkCode, generateMatchFeedback };