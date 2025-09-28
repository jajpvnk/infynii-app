import { BaseMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";
import type { TGraphStatus } from "./graph.js";
import type { TTavilySearchResult } from "./search.js";

// Search Graph State
export const RootGraphState = Annotation.Root({
  status: Annotation<TGraphStatus | "">({
    reducer: (x, y) => y ?? x ?? "",
    default: () => "",
  }),
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  currentQuery: Annotation<string>({
    reducer: (x, y) => y ?? x ?? "",
    default: () => "",
  }),
  alternativeQueries: Annotation<string[]>({
    reducer: (x, y) => y ?? x ?? [],
    default: () => [],
  }),
  searchAttempts: Annotation<number>({
    reducer: (x, y) => y ?? x ?? 0,
    default: () => 0,
  }),
  currentSearch: Annotation<{
    toolId?: string;
    frequencyId?: number;
    items?: TTavilySearchResult[];
  }>({
    reducer: (x, y) => y ?? x ?? { items: [] },
    default: () => ({ items: [] }),
  }),
});

export type TSearchState = typeof RootGraphState.State;


// Summarize Graph State
export const SummarizeGraphStatus = {
  STREAMING: "streaming",
  FINISHED: "finished",
  ERROR: "error",
} as const;

export type TSummarizeGraphStatus =
  (typeof SummarizeGraphStatus)[keyof typeof SummarizeGraphStatus];

export const SummarizeGraphState = Annotation.Root({
  status: Annotation<TSummarizeGraphStatus>({
    reducer: (x, y) => y ?? x ?? "",
    default: () => SummarizeGraphStatus.STREAMING,
  }),
  url: Annotation<string>({
    reducer: (x, y) => y ?? x ?? "",
    default: () => "",
  }),
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
});

export type TSummarizeState = typeof SummarizeGraphState.State;