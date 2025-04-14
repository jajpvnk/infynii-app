import { Prettify } from "./index.js";
import type { TSearchState } from "./server.js";

export const GraphStatus = {
  SEARCHABLE: "searchable",
  FINISHED: "finished",
  UNCLEAR: "unclear",
  NOT_SEARCHABLE: "not_searchable",
  TRANSFORMING: "transforming",
} as const;

export type TGraphStatus = (typeof GraphStatus)[keyof typeof GraphStatus];

export type TSerializedMessage = {
  id: string;
  type:
    | "human"
    | "ai"
    | "generic"
    | "developer"
    | "system"
    | "function"
    | "tool"
    | "remove";
  content: string;
  name?: string;
  tool_calls?: {
    id?: string;
    name: string;
    type: string;
    args: Record<string, any>;
  }[];
  tool_call_id?: string;
  timestamp: string;
  additional_kwargs?: { [key: string]: any };
};

export type TSearchChatResponse = Prettify<
  Omit<TSearchState, "messages"> & {
    messages: TSerializedMessage[];
    searchId: string;
  }
>;
