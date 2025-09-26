import type { LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");

    if (!code) {
      return new Response("Missing code from Facebook", { status: 400 });
    }
    const tokenUrl = `https://graph.facebook.com/v23.0/oauth/access_token?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(process.env.FACEBOOK_REDIRECT_URI!)}&client_secret=${process.env.FACEBOOK_APP_SECRET}&code=${code}`;

    // Exchange code for access token
    const res = await fetch(tokenUrl, {
      method: "POST",
      body: new URLSearchParams({
        client_id: process.env.FACEBOOK_APP_ID!,
        client_secret: process.env.FACEBOOK_APP_SECRET!,
        grant_type: "authorization_code",
        redirect_uri: process.env.FACEBOOK_REDIRECT_URI!,
        code,
      }),
    });

    const data = await res.json();

    // Try to save to database with error handling
    try {
      await prisma.socialAccount.create({
        data: {
          shop: "shop-test-test.vercel.app",
          provider: "facebook",
          accessToken: data.access_token,
          expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
        },
      });
      return new Response("Facebook token saved to database successfully! 🎉");
    } catch (dbError) {
      console.error("Database error:", dbError);
      return new Response(
        `Database error: ${dbError instanceof Error ? dbError.message : 'Unknown error'}\n\nFacebook data received: ${JSON.stringify(data, null, 2)}`,
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
