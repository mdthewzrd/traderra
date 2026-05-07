import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./prisma";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || 'traderra-dev-secret-change-in-prod',
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:6565',
  database: prismaAdapter(prisma, {
    provider: "postgres",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  plugins: [nextCookies()],
  cors: {
    origins: [
      'https://traderra-charts-staging.vercel.app',
      'https://traderra-charts.vercel.app',
      'http://localhost:6565',
      'http://localhost:3000',
    ],
    credentials: true,
  },
});

export type Session = typeof auth.$Infer.Session;
