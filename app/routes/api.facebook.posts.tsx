import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { session } = await authenticate.admin(request);
    
    // Get Facebook account for this shop
    const facebookAccount = await prisma.socialAccount.findUnique({
      where: {
        shop_provider: {
          shop: session.shop,
          provider: "facebook"
        }
      }
    });

    if (!facebookAccount || !facebookAccount.accessToken) {
      return json({
        success: false,
        error: "No Facebook account connected",
        posts: []
      });
    }

    // Fetch Facebook posts using server-side fetch (appropriate for external APIs)
    const facebookResponse = await fetch(
      `https://graph.facebook.com/me/posts?fields=id,message,created_time,full_picture,permalink_url&access_token=${facebookAccount.accessToken}`
    );

    const facebookData = await facebookResponse.json();

    if (!facebookResponse.ok) {
      return json({
        success: false,
        error: `Facebook API error: ${facebookData.error?.message || 'Unknown error'}`,
        posts: []
      });
    }

    return json({
      success: true,
      posts: facebookData.data || [],
      user: facebookAccount.userId,
      tokenExpires: facebookAccount.expiresAt
    });

  } catch (error) {
    console.error("Facebook API error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      posts: []
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  // Handle POST requests for Facebook operations
  const formData = await request.formData();
  const operation = formData.get("operation");

  switch (operation) {
    case "refresh_token":
      // Handle token refresh
      return json({ success: true, message: "Token refresh not implemented yet" });
    
    case "sync_posts":
      // Handle syncing posts to Shopify metafields
      return json({ success: true, message: "Sync not implemented yet" });
    
    default:
      return json({ success: false, error: "Unknown operation" });
  }
};
