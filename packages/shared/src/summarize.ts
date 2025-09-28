
import { TSummarizeGraphStatus } from "./server.js";
import { TSerializedMessage } from "./graph.js";

// Types for the content summarization endpoint
export type TSummarizeContentRequest = {
  id: string;
};

export type TSummarizeContentError = {
  error: string;
};

// Response type for content summarization streaming
export type TSummarizeResponse = {
  messages: TSerializedMessage[];
  status: TSummarizeGraphStatus;
  resultId: string;
};
