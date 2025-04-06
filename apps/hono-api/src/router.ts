import { Hono } from "hono";

export const handleRoutes = (app: Hono) =>
  app
    .get("/", (c) => c.json({ foo: 1 }))
    .get("/posts", (c) => c.json({ foo: 2 }))
    .get("/posts/:id", (c) => c.json({ foo: 3 }));

export type TAPIRouter = ReturnType<typeof handleRoutes>;
