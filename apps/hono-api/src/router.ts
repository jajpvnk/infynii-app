import { Hono } from "hono";

import { getSupabase, supabaseMiddleware } from "./middleware.js";
import searchAgent from "./agents/search/index.js";
import { streamText } from "hono/streaming";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

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
    );

export type TAPIRouter = ReturnType<typeof handleRoutes>;
