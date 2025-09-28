import { Prettify } from "./utils.js";

export type TTavilySearchResultRaw = {
  title: string;
  url: string;
  content: string;
  score: number;
};

export type TTavilySearchResult = Prettify<TTavilySearchResultRaw & {
  id: string;
  preview: string;
}>;