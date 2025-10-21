import type { StreamingApi } from "hono/utils/stream";
import { setupSummarizeGraph } from "./graph.js";
import type { Prettify, TSummarizeResponse } from "@jpvnk/infynii-shared";
import type { TSummarizeState } from "@jpvnk/infynii-shared/server";
import type { BaseMessage } from "@langchain/core/messages";
import { serializeMessage } from "../helpers.js";

const createSummarizationResponse = (
  update: Prettify<TSummarizeState>,
  resultId: string
): TSummarizeResponse => {
  const messages: BaseMessage[] = update?.messages ?? [];
  const serializedMessages = messages.map((message) =>
    serializeMessage(message)
  );
  return {
    ...update,
    messages: serializedMessages,
    resultId: resultId,
  };
};

// Summarization handler
const handleSummarization = async ({
  resultId,
  url,
  stream,
}: {
  resultId: string;
  url: string;
  stream: StreamingApi;
}) => {
  const graph = setupSummarizeGraph();

  const inputs = {
    url,
    messages: [],
  };

  // Stream summarization responses
  for await (const event of await graph.stream(inputs)) {
    const updates = Object.values<TSummarizeState>(event);

    for (const update of updates) {
      const response = createSummarizationResponse(update, resultId);
      await stream.write(JSON.stringify(response) + "\n");
    }
  }
};

// Main handler function
type TSummarizeAgentParams = {
  stream: StreamingApi;
  resultId: string;
  url: string;
};

export const handleSummarizeAgent = async ({
  resultId,
  url,
  stream,
}: TSummarizeAgentParams) => {
  if (!resultId || !url) {
    throw new Error("Result ID and URL are required");
  }

  await handleSummarization({
    resultId,
    url,
    stream,
  });
};
