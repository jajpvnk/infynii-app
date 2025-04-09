import { hc } from "hono/client";
import { createContext, useContext, useEffect, useState } from "react";

import type { TAPIRouter } from "@jpvnk/infynii-hono-api/dist/router";

const HonoContext = createContext<ReturnType<typeof hc<TAPIRouter>> | null>(
  null
);

const HonoProvider = ({ children }: { children: React.ReactNode }) => {
  const [client] = useState(() => hc<TAPIRouter>("http://localhost:8787"));

  useEffect(() => {
    (async () => {
      const res = await client.api.v1.stream.$post({
        body: {
          query: "What is the capital of France?",
        },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch");
      }

      const body = res.body;
      let reader = res.body?.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader?.read() ?? { done: true, value: null };
        if (done) break;
        // Convert Uint8Array to string
        // this is value [104, 101, 108, 108, 111, 10]
        // we need to convert it to a string
        console.log("---");
        try {
          const text = decoder.decode(value)
          console.log("text", text);
        } catch (error) {
          console.log("error", error);
        }
      }
    })();
  }, []);

  return <HonoContext.Provider value={client}>{children}</HonoContext.Provider>;
};

export const useHonoClient = () => {
  const client = useContext(HonoContext);
  if (!client) {
    throw new Error("Hono client not found");
  }
  return client;
};

export default HonoProvider;
