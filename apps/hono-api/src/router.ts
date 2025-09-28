import { Hono } from "hono";

import { getSupabase, supabaseMiddleware } from "./middleware.js";
import searchAgent from "./agents/search/index.js";
import summarizeAgent from "./agents/summarize/index.js";
import { streamText } from "hono/streaming";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { TSummarizeResponse } from "@jpvnk/infynii-shared";
import { SummarizeGraphStatus } from "@jpvnk/infynii-shared/server";

export const handleRoutes = (app: Hono) =>
  app
    .basePath("/api/v1")
    .get("/", (c) => c.json({ foo: 1 }))
    .get("/posts", (c) => c.json({ foo: 2 }))
    .get("/posts/:id", (c) => c.json({ foo: 3 }))
    .get("/frequencies", supabaseMiddleware(), async (c) => {
      const supabase = getSupabase(c);

      console.log("supabase", supabase);

      // const { data: userData, error: userError } =
      //   await supabase.auth.getUser();

      // if (userError || !userData?.user) {
      //   const message = userError ? userError.message : "Unauthorized";
      //   return c.json({ error: message }, 401);
      // }

      const { data, error } = await supabase
        .from("search_frequencies")
        .select("*");

      if (error) {
        return c.json({ error: error.message }, 500);
      }
      return c.json({ data: data ?? [] });
    })
    .post(
      "/stream",
      zValidator(
        "query",
        z.object({
          q: z.string().optional(),
          searchId: z.string().optional(),
          selectedFrequencyId: z.string().optional(),
        })
      ),
      async (c) => {
        return streamText(c, async (stream) => {
          await searchAgent({
            selectedFrequencyId: c.req.valid("query").selectedFrequencyId,
            query: c.req.valid("query").q,
            searchId: c.req.valid("query").searchId,
            stream,
          });
        });
      }
    )
    .get(
      "/search/:id",
      supabaseMiddleware(),
      zValidator(
        "param",
        z.object({
          id: z.string(),
        })
      ),
      async (c) => {
        const supabase = getSupabase(c);
        const searchId = c.req.valid("param").id;

        const { data, error } = await supabase
          .from("searches")
          .select("*")
          .eq("id", searchId)
          .single();

        if (error) {
          return c.json({ error: error.message }, 500);
        }

        return c.json(data);
      }
    )
    .patch(
      "/search/:id/trash",
      supabaseMiddleware(),
      zValidator(
        "param",
        z.object({
          id: z.string(),
        })
      ),
      async (c) => {
        const supabase = getSupabase(c);
        const searchId = c.req.valid("param").id;

        const { error } = await supabase
          .from("searches")
          .update({
            trashed_at: new Date().toISOString(),
          })
          .eq("id", searchId);

        if (error) {
          return c.json({ error: error.message }, 500);
        }

        return c.json({ success: true });
      }
    )
    .get(
      "/search-results/:id",
      supabaseMiddleware(),
      zValidator(
        "param",
        z.object({
          id: z.string(),
        })
      ),
      async (c) => {
        const supabase = getSupabase(c);
        const resultId = c.req.valid("param").id;

        try {
          const { data, error } = await supabase
            .from("searches_results")
            .select("*")
            .eq("id", resultId)
            .single();

          if (error) {
            return c.json({ error: error.message }, 500);
          }

          return c.json(data);
        } catch (error) {
          console.error("Error retrieving search result:", error);
          return c.json({ error: "Failed to retrieve search result" }, 500);
        }
      }
    )
    .post(
      "/search-results/:id/summarize",
      supabaseMiddleware(),
      zValidator(
        "param",
        z.object({
          id: z.string(),
        })
      ),
      async (c) => {
        const supabase = getSupabase(c);
        const resultId = c.req.valid("param").id;

        try {
          // Get the search result to retrieve the URL and basic info
          const { data: searchResult, error: searchError } = await supabase
            .from("searches_results")
            .select("url, title, preview")
            .eq("id", resultId)
            .single();

          if (searchError) {
            console.error("Error retrieving search result:", searchError);
            return c.json({ error: searchError.message }, 500);
          }

          if (!searchResult?.url) {
            console.error("No URL found for this search result");
            return c.json({ error: "No URL found for this search result" }, 404);
          }

          return streamText(c, async (stream) => {
            await summarizeAgent({
              resultId: resultId,
              url: searchResult.url!,
              stream,
            });
          });

          // test response
          // const tempResponse: TSummarizeResponse = {
          //   messages: [
          //     {
          //       type: "ai",
          //       content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
          //       id: resultId,
          //       timestamp: new Date().toISOString(),
          //     },
          //   ],
          //   status: SummarizeGraphStatus.FINISHED,
          //   resultId: resultId,
          // };

          // await new Promise((resolve) => setTimeout(resolve, 5000));

          // return c.json(tempResponse);
        } catch (error) {
          console.error("Error retrieving content for summarization:", error);
          return c.json({ error: "Failed to retrieve content for summarization" }, 500);
        }
      }
    )
    .patch(
      "/search-results/:id/summary",
      supabaseMiddleware(),
      zValidator(
        "param",
        z.object({
          id: z.string(),
        })
      ),
      zValidator(
        "json",
        z.object({
          summary: z.string(),
        })
      ),
      async (c) => {
        const supabase = getSupabase(c);
        const resultId = c.req.valid("param").id;
        const { summary } = c.req.valid("json");

        try {
          const { data, error } = await supabase
            .from("searches_results")
            .update({ summary })
            .eq("id", resultId)
            .select()
            .single();

          if (error) {
            console.error("Error saving summary:", error);
            return c.json({ error: error.message }, 500);
          }

          return c.json({ success: true, data });
        } catch (error) {
          console.error("Error saving summary:", error);
          return c.json({ error: "Failed to save summary" }, 500);
        }
      }
    );

export type TAPIRouter = ReturnType<typeof handleRoutes>;
