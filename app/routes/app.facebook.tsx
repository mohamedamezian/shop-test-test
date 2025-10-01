
import { LoaderFunction } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader: LoaderFunction = async ({ request }) => {
  const { session, redirect } = await authenticate.admin(request);
  const appId = process.env.FACEBOOK_APP_ID!;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI!;
  const scope = process.env.FACEBOOK_SCOPES!;
  const state = btoa(JSON.stringify({ shop: session.shop }));

  const authUrl = `https://www.facebook.com/v23.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${scope}&response_type=code&state=${state}`;
  console.log("Facebook OAuth URL:", authUrl);
  console.log("App ID:", appId);
  console.log("Redirect URI:", redirectUri);
  return redirect(authUrl, { target: "_parent" });
};