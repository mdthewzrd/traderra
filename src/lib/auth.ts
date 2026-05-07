import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./prisma";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || 'traderra-dev-secret-change-in-prod',
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:6565',
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
