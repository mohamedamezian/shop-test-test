import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { session } = await authenticate.admin(request);
    const formData = await request.formData();
    const provider = formData.get("provider") as string;
    const operation = formData.get("operation") as string;

    if (!provider || !["instagram", "facebook"].includes(provider)) {
      return json({ success: false, error: "Invalid provider" });
    }

    const account = await prisma.socialAccount.findUnique({
      where: {
        shop_provider: {
          shop: session.shop,
          provider: provider
        }
      }
    });

    if (!account) {
      return json({ success: false, error: `No ${provider} account connected` });
    }

    switch (operation) {
      case "refresh_instagram_token":
        // Refresh Instagram long-lived token
        const refreshUrl = `https://graph.instagram.com/refresh_access_token`;
        const refreshResponse = await fetch(
          `${refreshUrl}?grant_type=ig_refresh_token&access_token=${account.accessToken}`,
          { method: "GET" }
        );

        const refreshData = await refreshResponse.json();

        if (refreshResponse.ok) {
          // Update token in database
          await prisma.socialAccount.update({
            where: { id: account.id },
            data: {
              accessToken: refreshData.access_token,
              expiresAt: new Date(Date.now() + refreshData.expires_in * 1000)
            }
          });

          return json({ 
            success: true, 
            message: "Instagram token refreshed successfully",
            expiresAt: new Date(Date.now() + refreshData.expires_in * 1000)
          });
        } else {
          return json({ 
            success: false, 
            error: `Token refresh failed: ${refreshData.error?.message || 'Unknown error'}` 
          });
        }

      case "sync_to_metafields":
        // This would implement syncing social posts to Shopify metafields
        return json({ 
          success: true, 
          message: "Metafield sync not implemented yet" 
        });

      default:
        return json({ success: false, error: "Unknown operation" });
    }

  } catch (error) {
    console.error("Token management error:", error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    });
  }
};
