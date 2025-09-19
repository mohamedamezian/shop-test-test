
import { LoaderFunction } from "@remix-run/node";

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) {
    return new Response("No code provided", { status: 400 });
  }

  const appId = process.env.FACEBOOK_APP_ID!;
  const appSecret = process.env.FACEBOOK_APP_SECRET!;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI!;

  // Exchange code for access token
  const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`;
  
  let tokenResponse;
  try {
    console.log("Token exchange redirect_uri:", redirectUri);
    tokenResponse = await fetch(tokenUrl);
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return new Response(`Failed to fetch access token: ${errorText}`, { status: 500 });
    }
    const tokenData = await tokenResponse.json();
    // tokenData.access_token contains the user's access token
    return new Response(`Facebook login successful! Access token: ${tokenData.access_token}`);
  } catch (err) {
    return new Response(`Error fetching access token: ${err}`, { status: 500 });
  }
};

export default function FacebookCallback() {
  return <div>Facebook login callback received.</div>;
}
