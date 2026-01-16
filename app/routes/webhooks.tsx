import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * GDPR Compliance Webhooks Handler
 * 
 * This route handles mandatory GDPR webhooks for App Store submission:
 * - customers/data_request: Handle customer data access requests
 * - customers/redact: Handle customer data deletion requests
 * - shop/redact: Handle shop data deletion (48 hours after app uninstall)
 * 
 * HMAC validation is automatically handled by authenticate.webhook()
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    // authenticate.webhook() automatically validates HMAC signature
    const { topic, shop, payload } = await authenticate.webhook(request);

    console.log(`Received ${topic} webhook for ${shop}`);

    switch (topic) {
      case "CUSTOMERS_DATA_REQUEST":
        // Handle customer data request (GDPR Article 15)
        // You should:
        // 1. Collect all customer data you store
        // 2. Send it to the customer or shop owner
        // 3. Log the request for compliance
        
        console.log(`Customer data request received for shop: ${shop}`);
        console.log("Customer info:", payload);
        
        // Example: Check if you store any customer data
        // In this Instagram app, we typically don't store customer data
        // We only store shop-level Instagram data
        
        // If you need to send data back, implement email notification here
        
        break;

      case "CUSTOMERS_REDACT":
        // Handle customer data deletion (GDPR Article 17 - Right to be forgotten)
        // You should:
        // 1. Delete all data related to this customer
        // 2. Log the deletion for compliance
        
        console.log(`Customer data redaction requested for shop: ${shop}`);
        console.log("Customer info:", payload);
        
        // Example: Delete customer-specific data if you store any
        // For this Instagram app, we don't store individual customer data
        // so there's nothing to delete
        
        break;

      case "SHOP_REDACT":
        // Handle shop data deletion (GDPR Article 17)
        // Called 48 hours after merchant uninstalls your app
        // You MUST delete all shop data
        
        console.log(`Shop data redaction requested for shop: ${shop}`);
        console.log("Shop info:", payload);
        
        try {
          // Delete all data for this shop
          // 1. Delete social accounts (Instagram connections)
          await db.socialAccount.deleteMany({
            where: { shop },
          });
          console.log(`✓ Deleted social accounts for ${shop}`);
          
          // 2. Delete sessions
          await db.session.deleteMany({
            where: { shop },
          });
          console.log(`✓ Deleted sessions for ${shop}`);
          
          // Note: Shopify metaobjects and files are already deleted when the app is uninstalled
          // No need to manually delete them here
          
          console.log(`✓ Successfully redacted all data for shop: ${shop}`);
        } catch (error) {
          console.error(`Error redacting data for shop ${shop}:`, error);
          // Don't throw - return 200 to acknowledge receipt
          // Log error for manual review
        }
        
        break;

      default:
        console.log(`Unhandled webhook topic: ${topic}`);
    }

    // Always return 200 OK to acknowledge receipt
    // This prevents Shopify from retrying the webhook
    return new Response(null, { status: 200 });
    
  } catch (error) {
    console.error("Webhook processing error:", error);
    
    // If authenticate.webhook() throws, it means HMAC validation failed
    // Return 401 Unauthorized
    if (error instanceof Error && error.message.includes("HMAC")) {
      console.error("HMAC validation failed");
      return new Response("Unauthorized", { status: 401 });
    }
    
    // For other errors, still return 200 to prevent retries
    // but log the error for investigation
    return new Response(null, { status: 200 });
  }
};
