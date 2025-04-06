import { hc } from "hono/client";
import { createContext, useContext, useState } from "react";

import type { TAPIRouter } from "@jpvnk/infynii-hono-api/dist/router";

const HonoContext = createContext<ReturnType<typeof hc<TAPIRouter>> | null>(
  null
);

const HonoProvider = ({ children }: { children: React.ReactNode }) => {
  const [client] = useState(() => hc<TAPIRouter>("http://localhost:8787"));

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
