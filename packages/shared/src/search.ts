import { Prettify } from "./index.js";

export type TTavilySearchResultRaw = {
  title: string;
  url: string;
  content: string;
  score: number;
};

export type TTavilySearchResult = Prettify<TTavilySearchResultRaw & {
  id: string;
}>;