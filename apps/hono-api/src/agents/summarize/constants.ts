// Database configuration
export const DATABASE_CONNECTION_STRING = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// Gemini AI model configuration
export const GEMINI_MODEL_CONFIG = {
  model: "gemini-2.0-flash",
  temperature: 0.3, // Slightly higher temperature for more natural summaries
  maxRetries: 0,
} as const;

// Summarization configuration
export const MAX_CONTENT_LENGTH = 50000; // Maximum characters to process
export const MIN_CONTENT_LENGTH = 100; // Minimum characters required