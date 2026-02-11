// Database configuration
export const DATABASE_CONNECTION_STRING = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// Gemini AI model configuration
export const GEMINI_MODEL_CONFIG = {
  model: "gemini-2.5-flash",
  temperature: 0,
  maxRetries: 0,
} as const;

// Search configuration
export const MAX_SEARCH_RESULTS = 5;
export const MIN_SEARCH_RESULTS = 3;
export const THRESHOLD_SCORE = 0.5;
export const MAX_SEARCH_ATTEMPTS = 3;

// User configuration
export const TEMP_USER_ID = "90e568dc-9079-4f61-920f-abd29e0798ce";