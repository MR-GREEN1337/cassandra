// src/lib/embedding.ts
import OpenAI from 'openai';

// Use a singleton pattern to ensure we only initialize the client once.
let openai: OpenAI | null = null;

const getOpenAIClient = () => {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set in the environment variables.');
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
};

/**
 * Generates an embedding for a given text using OpenAI's API.
 * @param text The text to generate an embedding for.
 * @returns A promise that resolves to an array of numbers representing the embedding.
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
  const client = getOpenAIClient();
  
  // Ensure the input is not empty and replace newlines, which can affect performance.
  const input = text.replace(/\n/g, ' ');

  try {
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small', // Recommended model for cost and performance
      input,
    });

    const embedding = response.data[0].embedding;
    return embedding;
  } catch (error) {
    console.error('Error generating embedding from OpenAI:', error);
    throw new Error('Failed to generate text embedding.');
  }
};