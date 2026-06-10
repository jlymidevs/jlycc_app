// app/src/types/next-auth.d.ts
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      role?: string;
      personId?: number | null;
    } & DefaultSession["user"];
  }
}

// next-auth v5 beta re-exports JWT from @auth/core/jwt — augment the real module.
declare module "@auth/core/jwt" {
  interface JWT {
    role?: string;
    personId?: number | null;
  }
}
