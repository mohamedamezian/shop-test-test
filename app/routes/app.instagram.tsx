
import { LoaderFunction } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";


export const loader: LoaderFunction = async ({ request }) => {
  const { session, redirect } = await authenticate.admin(request);
  const appId = process.env.INSTAGRAM_APP_ID!;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI!;
  const scope = process.env.INSTA_SCOPES!;
  const state = btoa(JSON.stringify({ shop: session.shop }));

  const alreadyConnected = await prisma.socialAccount.findUnique({
    where: {
      shop_provider: {
        shop: session.shop,
        provider: "instagram"
      }
    }
  });

  if (alreadyConnected && alreadyConnected.expiresAt && alreadyConnected.expiresAt > new Date()) {
    return new Response ("Already connected", { status: 200 });
  }
  
  
  const authUrl = `https://www.instagram.com/oauth/authorize?force_reauth=true&client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${state}`;

  console.log("Instagram OAuth URL:", authUrl);
  console.log("App ID:", appId);
  console.log("Redirect URI:", redirectUri);      
  return redirect(authUrl, { target: "_parent" });
  
};