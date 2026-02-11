import type { TSerializedMessage } from "@jpvnk/infynii-shared";
import { makeid } from "@/helpers";

// Utility functions for chat functionality
export const formatTimestamp = (timestamp: string): string => {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const createUserMessage = (content: string, messageCount: number): TSerializedMessage => ({
  type: "human",
  content,
  id: `${makeid(6)}-${messageCount}`,
  timestamp: new Date().toISOString(),
});
