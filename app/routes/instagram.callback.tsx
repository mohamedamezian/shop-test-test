import type { LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");

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
        redirect_uri: process.env.INSTAGRAM_REDIRECT_URI!,
        code,
      }),
    });

    const data = await res.json();

    // Check if we got a short-lived token successfully
    if (!data.access_token) {
      return new Response(
        `Failed to get Instagram token: ${JSON.stringify(data, null, 2)}`,
        { status: 400, headers: { "Content-Type": "text/plain" } }
      );
    }

    // Exchange short-lived token for long-lived token (60 days)
    const longLivedTokenUrl = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_APP_SECRET}&access_token=${data.access_token}`;
    
    const longLivedRes = await fetch(longLivedTokenUrl, { method: "GET" });
    const longLivedData = await longLivedRes.json();

    // Use the long-lived token if successful, otherwise fall back to short-lived
    const finalToken = longLivedData.access_token || data.access_token;
    const tokenType = longLivedData.access_token ? "long-lived" : "short-lived";
    const expiresAt = longLivedData.expires_in 
      ? new Date(Date.now() + longLivedData.expires_in * 1000)
      : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days default

    // Update existing or create new Instagram token
    try {
      await prisma.socialAccount.upsert({
        where: {
          shop_provider: {
            shop: "shop-test-test.vercel.app",
            provider: "instagram"
          }
        },
        update: {
          accessToken: finalToken,
          userId: data.user_id?.toString(),
          expiresAt: expiresAt,
        },
        create: {
          shop: "shop-test-test.vercel.app",
          provider: "instagram",
          accessToken: finalToken,
          userId: data.user_id?.toString(),
          expiresAt: expiresAt,
        },
      });
      
      return new Response(
        `Instagram ${tokenType} token saved successfully! 🎉\n\n` +
        `Token type: ${tokenType}\n` +
        `Expires: ${expiresAt.toISOString()}\n` +
        `User ID: ${data.user_id}\n\n` +
        `Original response: ${JSON.stringify(data, null, 2)}\n\n` +
        `Long-lived response: ${JSON.stringify(longLivedData, null, 2)}`,
        { status: 200, headers: { "Content-Type": "text/plain" } }
      );
    } catch (dbError) {
      console.error("Database error:", dbError);
      return new Response(
        `Database error: ${dbError instanceof Error ? dbError.message : 'Unknown error'}\n\nInstagram data received: ${JSON.stringify(data, null, 2)}`,
        { status: 500, headers: { "Content-Type": "text/plain" } }
      );
    }

  } catch (error) {
    console.error("General error:", error);
    return new Response(
      `Server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { status: 500 }
    );
  }
};
