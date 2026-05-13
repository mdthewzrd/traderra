import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

// OAuth callback: better-auth sets cookie on this domain, we read it and redirect
// to the originating site (staging or production charts) with the token in the URL.
// The destination is encoded as base64 in the URL path: /auth-callback/{base64}
// This avoids query-param issues with better-auth's state handling.

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  let token: string | null = null;

  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (session?.session?.token) {
      token = session.session.token;
    }
  } catch {}

  // Decode destination from path: /auth-callback/{base64} or /auth-callback?callbackURL=...
  const { path } = await params;
  let callbackURL = "https://traderra-charts-staging.vercel.app/";

  if (path && path.length > 0) {
    try {
      callbackURL = atob(path[0]);
    } catch {
      // Invalid base64 — use default
    }
  } else {
    // Fallback: check query param (legacy)
    const url = new URL(request.url);
    const cb = url.searchParams.get("callbackURL");
    if (cb) callbackURL = cb;
  }

  if (token) {
    const redirectURL = new URL(callbackURL);
    redirectURL.searchParams.set("token", token);
    redirect(String(redirectURL));
  }

  // No token — redirect to charts anyway
  redirect(callbackURL);
}
