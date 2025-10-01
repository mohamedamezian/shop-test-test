
import { LoaderFunctionArgs, redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Authenticate with Shopify to get the shop context
  const { session } = await authenticate.admin(request);
  
  const appId = process.env.FACEBOOK_APP_ID!;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI!;
  const scope = process.env.FACEBOOK_SCOPES!;

  // Store the shop in the state parameter so we can retrieve it in the callback
  const state = encodeURIComponent(JSON.stringify({ shop: session.shop }));

  const authUrl = `https://www.facebook.com/v23.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${scope}&response_type=code&state=${state}`;
  
  console.log("Facebook OAuth URL:", authUrl);
  console.log("App ID:", appId);
  console.log("Redirect URI:", redirectUri);
  console.log("Shop:", session.shop);
  
  return redirect(authUrl);
};