import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

// Charts login: started from staging/production charts page.
// This page runs on the API domain (same-origin as better-auth) so cookies work.
// 1. Starts the OAuth flow (same-origin POST → cookies are set properly)
// 2. After OAuth, better-auth redirects to /auth-callback/{base64-dest}
// 3. /auth-callback reads the session and redirects to charts with token

export async function GET(request: Request) {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider") || "github";
  const destEncoded = url.searchParams.get("dest") || btoa("https://traderra-charts-staging.vercel.app/");

  const callbackURL = `${url.origin}/auth-callback/${destEncoded}`;

  // Start OAuth same-origin (cookies will be set on this domain)
  try {
    const baseURL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || url.origin;
    const res = await fetch(`${baseURL}/api/auth/sign-in/social`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: request.headers.get("cookie") || "",
      },
      body: JSON.stringify({ provider, callbackURL }),
    });

    const data = await res.json();
    if (data.url) {
      redirect(data.url);
    }
  } catch {}

  // Fallback: redirect to charts
  try {
    const dest = atob(destEncoded);
    redirect(dest);
  } catch {
    redirect("https://traderra-charts-staging.vercel.app/");
  }
}
