import { useCallback } from "react";
import type { TSearchChatResponse } from "@jpvnk/infynii-hono-api/dist/agents/search";

type TProcessStreamResponseParams = {
  response: Response;
  onData: (data: TSearchChatResponse) => void;
  onError: (error: string) => void;
  onComplete: () => void;
};

// Custom hook for streaming responses
export const useStreamResponse = () => {
  const processStreamResponse = useCallback(async ({
    response,
    onData,
    onError,
    onComplete
  }: TProcessStreamResponseParams) => {
    if (!response.ok) {
      onError("Failed to send message, please try again.");
      return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = (await reader?.read()) ?? {
          done: true,
          value: null,
        };

        if (done) {
          onComplete();
          break;
        }

        const text = decoder.decode(value);
        const data = JSON.parse(text) as TSearchChatResponse;
        onData(data);
      }
    } catch (error) {
      console.log("Stream processing error:", error);
      onError("Failed to process response, please try again.");
    }
  }, []);

  return { processStreamResponse };
};
