
import { LoaderFunction, redirect } from "@remix-run/node";

export const loader: LoaderFunction = async () => {
  const appId = process.env.INSTAGRAM_APP_ID!;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI!;
  const scope = process.env.INSTA_SCOPES || "instagram_basic";

  const authUrl = `https://www.instagram.com/oauth/authorize?force_reauth=true&client_id=${appId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=${scope}`;

  console.log("Facebook OAuth URL:", authUrl);
  console.log("App ID:", appId);
  console.log("Redirect URI:", redirectUri);
  return redirect(authUrl);
};