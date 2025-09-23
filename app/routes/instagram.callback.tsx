import type { LoaderFunctionArgs } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return new Response("Missing code from Instagram", { status: 400 });
  }

  const tokenUrl = `https://graph.instagram.com/v23.0/oauth/access_token?client_id=1565375811115462&redirect_uri=https://shop-test-test.vercel.app/instagram/callback&client_secret=f43bd7853db5f37a3b17356699ecab36&code=${code}`;

  // Exchange code for access token
  const res = await fetch(tokenUrl, {
    method: "POST",
    body: new URLSearchParams({
      client_id: "1565375811115462",
      client_secret: "f43bd7853db5f37a3b17356699ecab36",
      grant_type: "authorization_code",
      redirect_uri: "https://shop-test-test.vercel.app/instagram/callback",
      code,
    }),
  });

  const data = await res.json();

  return new Response(
    `<pre>${JSON.stringify(data, null, 2)}</pre>`,
    { headers: { "Content-Type": "text/html" } }
  );
};
