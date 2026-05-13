// This is an HTML page, not a route handler.
// The browser loads this page on the API domain, then JS does the OAuth POST
// same-origin so better-auth's state cookie lands in the browser.

export async function GET(request: Request) {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider") || "github";
  const destEncoded = url.searchParams.get("dest") || btoa("https://traderra-charts-staging.vercel.app/");

  const html = `<!DOCTYPE html>
<html><head><title>Signing in...</title>
<style>body{background:#0c0e14;color:#dde3f0;font-family:Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}
.spinner{width:24px;height:24px;border:3px solid #2a3050;border-top-color:#D4AF37;border-radius:50%;animation:spin .8s linear infinite;margin-right:12px;}
@keyframes spin{to{transform:rotate(360deg)}}</style>
</head><body><div class="spinner"></div>Redirecting to ${provider}...</div>
<script>
fetch('/api/auth/sign-in/social',{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({provider:'${provider}',callbackURL:location.origin+'/auth-callback/${destEncoded}'})
}).then(r=>r.json()).then(d=>{
  if(d.url) location.href=d.url;
  else { document.body.innerText='Sign-in failed. Close this tab and try again.'; }
}).catch(e=>{ document.body.innerText='Error: '+e.message; });
</script></body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}
