import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

// OAuth callback: better-auth sets cookie on this domain, we read it and redirect
// to the staging site with the token in the URL
export async function GET(request: Request) {
  let token: string | null = null;

  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (session?.session?.token) {
      token = session.session.token;
    }
  } catch {}

  const url = new URL(request.url);
  const callbackURL = url.searchParams.get("callbackURL") || "https://traderra-charts-staging.vercel.app/";

  if (token) {
    const redirectURL = new URL(callbackURL);
    redirectURL.searchParams.set("token", token);
    redirect(String(redirectURL));
  }

  // No token — redirect to staging
  redirect(callbackURL);
}
