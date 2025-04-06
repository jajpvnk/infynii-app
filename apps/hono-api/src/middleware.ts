import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Context, MiddlewareHandler } from "hono";
import { env } from "hono/adapter";
import { getCookie, setCookie } from "hono/cookie";
import type { Database } from "./db-schema.js";

declare module "hono" {
  interface ContextVariableMap {
    supabase: SupabaseClient<Database>;
  }
}

export const getSupabase = (c: Context) => {
  return c.get("supabase");
};

type TSupabaseEnv = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
};

export const supabaseMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    const supabaseEnv = env<TSupabaseEnv>(c);
    const supabaseUrl = supabaseEnv.SUPABASE_URL;
    const supabaseAnonKey = supabaseEnv.SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
      throw new Error("SUPABASE_URL missing!");
    }

    if (!supabaseAnonKey) {
      throw new Error("SUPABASE_ANON_KEY missing!");
    }

    const supabase = createServerClient<Database>(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return Object.entries(getCookie(c)).map(([name, value]) => ({
              name,
              value,
            }));
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              setCookie(c, name, value, options as any);
            });
          },
        },
      }
    );

    c.set("supabase", supabase);

    await next();
  };
};
