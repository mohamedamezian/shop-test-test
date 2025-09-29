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
          accessToken: data.access_token,
          expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
        },
        create: {
          shop: "shop-test-test.vercel.app",
          provider: "instagram",
          accessToken: data.access_token,
          expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
        },
      });
            return new Response(`Instagram token saved to database successfully! ${JSON.stringify(data, null, 2)}🎉`,
      { status: 500, headers: { "Content-Type": "text/plain" } }
    
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
