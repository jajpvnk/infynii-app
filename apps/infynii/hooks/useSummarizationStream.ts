import { useCallback } from "react";
import type { TSummarizeResponse } from "@jpvnk/infynii-shared";

type TProcessSummarizationStreamParams = {
  response: Response;
  onData: (data: TSummarizeResponse) => void;
  onError: (error: string) => void;
  onComplete: () => void;
};

// Custom hook for processing content summarization streaming responses
export const useSummarizationStream = () => {
  const processSummarizationStream = useCallback(
    async ({
      response,
      onData,
      onError,
      onComplete,
    }: TProcessSummarizationStreamParams) => {
      if (!response.ok) {
        onError("Failed to start summarization, please try again.");
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = (await reader?.read()) ?? {
            done: true,
            value: null,
          };

          if (done) {
            if (buffer.trim().length) {
              try {
                const finalData = JSON.parse(buffer) as TSummarizeResponse;
                onData(finalData);
              } catch {}
            }
            onComplete();
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) {
              continue;
            }
            try {
              const data = JSON.parse(line) as TSummarizeResponse;
              onData(data);
            } catch {
              // ignore malformed line; leftover stays in buffer
            }
          }
        }
      } catch (error) {
        console.log("Summarization stream processing error:", error);
        onError("Failed to process summarization response, please try again.");
      }
    },
    []
  );

  return { processSummarizationStream };
};
