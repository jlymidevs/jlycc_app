// app/src/lib/auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";
import { users } from "@/schema/app";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { provisionMemberProfile } from "@/lib/provision";

const providers = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    })
  );
}

providers.push(
  Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, credentials.email as string))
        .limit(1);

      if (!user || !user.passwordHash || !user.isActive) return null;

      const valid = await bcrypt.compare(
        credentials.password as string,
        user.passwordHash
      );
      if (!valid) return null;

      return { id: user.userId, email: user.email, name: user.name };
    },
  })
);

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const email = user.email!;
        const [existing] = await db
          .select({ userId: users.userId, isActive: users.isActive })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);
        if (existing) return existing.isActive;

        // Unknown Google account → auto-create a MEMBER with a profile.
        const fullName = user.name ?? email;
        const parts = fullName.trim().split(/\s+/);
        const firstName = parts.slice(0, -1).join(" ") || parts[0];
        const lastName = parts.length > 1 ? parts[parts.length - 1] : "—";
        const [created] = await db
          .insert(users)
          .values({ email, name: fullName, role: "MEMBER" })
          .returning({ userId: users.userId });
        await provisionMemberProfile(created.userId, email, firstName, lastName);
        return true;
      }
      return true;
    },
    async jwt({ token }) {
      // Refresh role/personId from DB on every token rotation so role
      // changes apply without re-login lag beyond token refresh.
      if (token.email) {
        const [u] = await db
          .select({
            role: users.role,
            personId: users.personId,
            isActive: users.isActive,
          })
          .from(users)
          .where(eq(users.email, token.email))
          .limit(1);
        if (u) {
          token.role = u.role;
          token.personId = u.personId;
          if (!u.isActive) token.role = undefined;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role;
        session.user.personId = token.personId ?? null;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (user.email) {
        try {
          await db
            .update(users)
            .set({ lastLoginAt: new Date() })
            .where(eq(users.email, user.email));
        } catch {
          // non-critical — don't break auth if this fails
        }
      }
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
});
