import { Hono } from "hono";

import { getSupabase, supabaseMiddleware } from "./middleware.js";
import searchAgent from "./agents/search.js";
import { streamText, stream } from "hono/streaming";

export const handleRoutes = (app: Hono) =>
  app
    .basePath("/api/v1")
    .get("/", (c) => c.json({ foo: 1 }))
    .get("/posts", (c) => c.json({ foo: 2 }))
    .get("/posts/:id", (c) => c.json({ foo: 3 }))
    .get("/testing", supabaseMiddleware(), async (c) => {
      const supabase = getSupabase(c);

      const { data, error } = await supabase.auth.getUser();

      if (error) console.log("error", error);
      if (!data?.user) {
        return c.json({
          message: "You are not logged in.",
        });
      }

      const { data: testingData, error: testingError } = await supabase
        .from("testing")
        .select("*");
      if (testingError) {
        return c.json({ error: testingError.message }, 500);
      }
      return c.json({ data: testingData });
    })
    .post("/stream", async (c) => {
      return streamText(c, async (stream) => {
        await searchAgent({
          query: "What is the capital of the Slovakia?",
          stream,
        });
      });
    });

export type TAPIRouter = ReturnType<typeof handleRoutes>;
