import { LoaderFunction, redirect } from "@remix-run/node";

export const loader: LoaderFunction = async () => {
  const clientId = process.env.INSTAGRAM_CLIENT_ID!;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI!;
  const scope = "user_profile,user_media";

  const authUrl = `https://api.instagram.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${scope}&response_type=code`;
  console.log("Instagram OAuth URL:", authUrl);
  console.log("Client ID:", clientId);
  console.log("Redirect URI:", redirectUri);
  return console.log(authUrl);
};

export default function InstagramIndex() {
  return <div>Instagram Page</div>;
}
