import OpenAI from "openai";

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not defined. Add it to your .env file.");
  }

  return new OpenAI({ apiKey });
}

// Optional: keep config constants here if you use embeddings
export const EMBEDDING_CONFIG = {
  model: "text-embedding-3-small",
};
