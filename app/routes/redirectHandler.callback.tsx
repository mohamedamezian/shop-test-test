import type { LoaderFunctionArgs } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const type = url.searchParams.get("type");

  if( type === "facebook") {
    // Facebook token exchange logic  
    if (!code) {
      return new Response("Missing code from Facebook", { status: 400 });
    }
      const tokenUrl = `https://graph.facebook.com/v23.0/oauth/access_token?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI!)}&client_secret=${process.env.FACEBOOK_APP_SECRET}&code=${code}`;
      // Exchange code for access token
  const res = await fetch(tokenUrl, {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.FACEBOOK_APP_ID!,
      client_secret: process.env.FACEBOOK_APP_SECRET!,
      grant_type: "authorization_code",
      redirect_uri: process.env.REDIRECT_URI!,
      code,
    }),
  });
   const data = await res.json();
     return new Response(
    `<pre>${JSON.stringify(data, null, 2)}</pre>`,
    { headers: { "Content-Type": "text/html" } }
  );
  }else{
    // Instagram token exchange logic
    if (!code) {
      return new Response("Missing code from Instagram", { status: 400 });
    }
    const tokenUrl = `https://api.instagram.com/oauth/access_token`;
      // Exchange code for access token
  const res = await fetch(tokenUrl, {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID!,
      client_secret: process.env.INSTAGRAM_APP_SECRET!,
      grant_type: "authorization_code",
      redirect_uri: process.env.REDIRECT_URI!,
      code,
    }),
  });
   const data = await res.json();
     return new Response(
    `<pre>${JSON.stringify(data, null, 2)}</pre>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
}