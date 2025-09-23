
import { LoaderFunction, redirect } from "@remix-run/node";

export const loader: LoaderFunction = async () => {
  const appId = process.env.FACEBOOK_APP_ID!;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI!;
  const scope = process.env.INSTA_SCOPES || "instagram_basic";

  const authUrl = `https://www.facebook.com/v23.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${scope}&response_type=code`;
  console.log("Facebook OAuth URL:", authUrl);
  console.log("App ID:", appId);
  console.log("Redirect URI:", redirectUri);
  return redirect(authUrl);
};