
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is missing from .env");
  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    flashcards: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          answer: { type: Type.STRING },
        },
        required: ["question", "answer"],
      },
    },
    quiz: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          answer: { type: Type.STRING },
          explanation: { type: Type.STRING },
        },
        required: ["question", "options", "answer", "explanation"],
      },
    },
  },
  required: ["title", "flashcards", "quiz"],
};

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function isTemporaryError(error) {
  const status = Number(
    error.status || error.code || error.response?.status
  );

  return (
    [408, 429, 500, 502, 503, 504].includes(status) ||
    /high demand|unavailable|overloaded|rate limit|resource exhausted/i.test(
      error.message || ""
    )
  );
}

async function generateStudyMaterial(notes) {
  const prompt = `
You are an expert AI Study Assistant.

Carefully understand these study notes:

${notes}

Create:
1. Exactly 10 useful flashcards.
2. Exactly 10 multiple-choice quiz questions.
3. Each quiz question must have exactly 4 options.
4. The answer must exactly match one of the options.
5. Include a short explanation for every quiz answer.
6. Base all questions and answers on the supplied notes.
7. Avoid duplicate questions.

Return only valid JSON matching the required schema.
`;

  const delays = [2000, 4000, 8000];

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      console.log(`Gemini request: attempt ${attempt + 1}/3`);

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.3,
          maxOutputTokens: 8192,
        },
      });

      const result = JSON.parse(response.text);

      if (
        !result.title ||
        !Array.isArray(result.flashcards) ||
        !Array.isArray(result.quiz) ||
        result.flashcards.length !== 10 ||
        result.quiz.length !== 10
      ) {
        throw new Error("Gemini returned incomplete study material.");
      }

      for (const card of result.flashcards) {
        if (!card.question || !card.answer) {
          throw new Error("Invalid flashcard received.");
        }
      }

      for (const question of result.quiz) {
        if (
          !question.question ||
          !Array.isArray(question.options) ||
          question.options.length !== 4 ||
          !question.options.includes(question.answer) ||
          !question.explanation
        ) {
          throw new Error("Invalid quiz question received.");
        }
      }

      console.log(
        "Successfully generated 10 flashcards and 10 quiz questions."
      );

      return result;
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error.message);

      if (!isTemporaryError(error) || attempt === 2) {
        throw error;
      }

      console.log(
        `Temporary Gemini issue. Retrying in ${delays[attempt] / 1000} seconds...`
      );

      await sleep(delays[attempt]);
    }
  }
}

app.get("/", (req, res) => {
  res.send("StudySpark Backend is running!");
});

app.post("/api/generate", async (req, res) => {
  const { notes } = req.body || {};

  if (typeof notes !== "string" || !notes.trim()) {
    return res.status(400).json({
      error: "Please provide study notes.",
    });
  }

  if (notes.length > 30000) {
    return res.status(400).json({
      error: "Please keep your notes below 30,000 characters.",
    });
  }

  try {
    console.log("Generating study material...");

    const result = await generateStudyMaterial(notes);

    return res.json(result);
  } catch (error) {
    console.error("Generation failed:", error.message);

    const unavailable = isTemporaryError(error);

    return res.status(unavailable ? 503 : 500).json({
      error: unavailable
        ? "Gemini is temporarily busy. Please try again shortly."
        : "Unable to generate study material. Please try again.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`StudySpark backend running at http://localhost:${PORT}`);
});
