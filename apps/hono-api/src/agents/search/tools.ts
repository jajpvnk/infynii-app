import z from "zod";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { tool } from "@langchain/core/tools";
import { randomUUID } from "crypto";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import type {
  TTavilySearchResult,
  TTavilySearchResultRaw,
} from "@jpvnk/infynii-shared";
import { GEMINI_MODEL_CONFIG, MAX_SEARCH_RESULTS } from "./constants.js";

// Function to create preview text from content
const createPreviewText = (content: string, maxLength: number = 150): string => {
  if (!content) return "";
  
  // Clean up the content by removing extra whitespace and newlines
  const cleanedContent = content.replace(/\s+/g, ' ').trim();
  
  if (cleanedContent.length <= maxLength) {
    return cleanedContent;
  }
  
  // Find the last complete word within the limit
  const truncated = cleanedContent.substring(0, maxLength);
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  
  if (lastSpaceIndex > maxLength * 0.8) { // If we can find a good break point
    return truncated.substring(0, lastSpaceIndex) + '...';
  }
  
  return truncated + '...';
};

export const rawModel = new ChatGoogleGenerativeAI(GEMINI_MODEL_CONFIG);

export const searchTool = tool(
  async ({ query }: { query: string }) => {
    // tavily api
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
    const rawResults: TTavilySearchResultRaw[] = data?.results ?? [];
    
    // Transform raw results to include preview text
    const results: TTavilySearchResult[] = rawResults.map((result) => ({
      id: randomUUID(),
      ...result,
      preview: createPreviewText(result.content),
    }));

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
    preview: result.preview,
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
