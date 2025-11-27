import { DynamicStructuredTool } from "@langchain/core/tools";
import {
  MAX_CONTENT_LENGTH,
  MIN_CONTENT_LENGTH,
} from "./constants.js";

type TTavilyExtractResponse = {
  results: TTavilyExtractResultRaw[];
  failed_results: {
    url: string;
    error: string;
  }[];
  response_time: number;
  request_id: string;
};

type TTavilyExtractResultRaw = {
  url: string;
  raw_content: string;
  images: string[];
  favicon: string;
};

// Content fetching tool using Tavily extraction endpoint
export const contentFetchTool = new DynamicStructuredTool({
  name: "contentFetchTool",
  description:
    "Fetch and extract content from a web URL using Tavily extraction API",
  schema: {
    type: "object",
    properties: {
      url: { type: "string", description: "The URL to fetch content from" },
    },
    required: ["url"],
  } as const,
  func: async ({ url }: { url: string }) => {
    try {
      const tavilyApiKey = process.env.TAVILY_API_KEY;
      if (!tavilyApiKey) {
        throw new Error("TAVILY_API_KEY environment variable is not set");
      }

      const response = await fetch("https://api.tavily.com/extract", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tavilyApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          urls: url,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Tavily API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as TTavilyExtractResponse;
      const rawResults: TTavilyExtractResultRaw[] = data.results ?? [];

      console.log("rawResults:", rawResults);

      let content = rawResults?.[0].raw_content;
      const contentUrl = rawResults?.[0].url;

      // Limit content length to avoid token limits
      if (content.length > MAX_CONTENT_LENGTH) {
        content = content.substring(0, MAX_CONTENT_LENGTH) + "...";
      }

      if (content.length < MIN_CONTENT_LENGTH) {
        throw new Error("Content too short to summarize");
      }

      return {
        content,
        url: contentUrl,
      };
    } catch (error) {
      console.error("Error fetching web content via Tavily:", error);
      throw new Error(
        `Failed to fetch content from ${url}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  },
});
