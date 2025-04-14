import z from "zod";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { tool } from "@langchain/core/tools";
import { randomUUID } from "crypto";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import type { TTavilySearchResult, TTavilySearchResultRaw } from "@jpvnk/infynii-shared";
import { GEMINI_MODEL_CONFIG, MAX_SEARCH_RESULTS } from "./constants.js";

export const rawModel = new ChatGoogleGenerativeAI(GEMINI_MODEL_CONFIG);

export const searchTool = tool(
  async ({ query }: { query: string }) => {
    const resp = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        max_results: MAX_SEARCH_RESULTS,
        time_range: "month",
      }),
    });

    if (!resp.ok) {
      throw new Error("Failed to search");
    }

    const data = await resp.json();
    const results: TTavilySearchResult[] = data?.results ?? [];

    return results;
  },
  {
    name: "searchTool",
    description:
      "Use Tavily to search the web for relevant results according to the user's query.",
    schema: z.object({
      query: z.string(),
    }),
  }
);

export const createSearchToolMessages = (
  query: string,
  results: TTavilySearchResult[]
) => {
  const toolId = randomUUID();
  const previewItems = results.map((result) => ({
    id: result.id,
    title: result.title,
    url: result.url,
    score: result.score,
  }));
  return {
    messages: [
      new AIMessage({
        content: "",
        tool_calls: [
          {
            id: toolId,
            name: "search_tool",
            type: "tool_call",
            args: { query },
          },
        ],
      }),
      new ToolMessage({
        name: "search_tool",
        tool_call_id: toolId,
        content: JSON.stringify(previewItems),
      }),
    ],
    currentSearchToolId: toolId,
  };
};