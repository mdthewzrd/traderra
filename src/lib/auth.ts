import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./prisma";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || 'traderra-dev-secret-change-in-prod',
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || 'http://localhost:3199',
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "user", inputType: "hidden", required: false },
      status: { type: "string", defaultValue: "pending", inputType: "hidden", required: false },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 90, // 90 days — solo dev tool; stop the weekly logouts
    updateAge: 60 * 60 * 24, // refresh the expiry once per day
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
      'http://localhost:3199',
      'http://100.118.174.102:6565',
    ],
    credentials: true,
  },
});

export type Session = typeof auth.$Infer.Session;
