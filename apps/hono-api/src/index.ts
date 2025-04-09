import { serve } from "@hono/node-server";
import { Hono } from "hono";

import { handleRoutes } from "./router.js";

const hostname = process.env.HOST ?? "localhost";
const port = parseInt(process.env.PORT ?? "8787");

const app = new Hono();

handleRoutes(app);

serve(
  {
    hostname,
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Server is running on http://${hostname}:${info.port}`);
  }
);
