import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * GDPR Compliance Webhooks Handler
 *
 * This endpoint handles all mandatory GDPR compliance webhooks:
 * - customers/data_request: Customer requests their data
 * - customers/redact: Request to delete customer data
 * - shop/redact: Request to delete all shop data (48h after uninstall)
 *
 * For this app (Near Native Reviews):
 * - Reviews are stored in Shopify metaobjects (nn_reviews)
 * - No customer data is stored in external databases
 * - Session data is stored in our database (cleaned up on shop/redact)
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`[GDPR] Received ${topic} webhook for ${shop}`);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST": {
      const data = payload as {
        shop_id: number;
        shop_domain: string;
        orders_requested: number[];
        data_request: { id: number };
      };

      console.log(`[GDPR] Data request ID: ${data.data_request.id}`);

      console.log(
        `[GDPR] Orders requested: ${data.orders_requested.join(", ")}`,
      );

      // Since we store all data in Shopify metaobjects, no additional action is needed.
      console.log(
        `[GDPR] ✓ Data request acknowledged. All customer data is stored in Shopify metaobjects.`,
      );

      return new Response("Data request acknowledged", { status: 200 });
    }

    case "CUSTOMERS_REDACT": {
      const data = payload as {
        shop_id: number;
        shop_domain: string;
        orders_to_redact: number[];
      };

      console.log(
        `[GDPR] Orders to redact: ${data.orders_to_redact.join(", ")}`,
      );

      // Since we store all data in Shopify metaobjects and don't maintain external databases,
      // Shopify handles metaobject cleanup when customers are deleted.
      console.log(
        `[GDPR] ✓ Customer redaction acknowledged. All data is managed by Shopify metaobjects.`,
      );

      return new Response("Customer redaction acknowledged", { status: 200 });
    }

    case "SHOP_REDACT": {
      const data = payload as {
        shop_id: number;
        shop_domain: `${string}.myshopify.com`;
      };

      console.log(
        `[GDPR] Shop to redact - ID: ${data.shop_id}, Domain: ${data.shop_domain}`,
      );

      try {
        // Delete all session data for this shop from our database
        const deletedSessions = await db.session.deleteMany({
          where: { shop: data.shop_domain },
        });

        console.log(
          `[GDPR] ✓ Deleted ${deletedSessions.count} session(s) for shop ${data.shop_domain}`,
        );

        console.log(
          `[GDPR] ✓ Shop data redaction complete. Review data remains in shop's metaobjects.`,
        );

        return new Response("Shop data redacted successfully", { status: 200 });
      } catch (error) {
        console.error(`[GDPR] Error redacting shop data:`, error);
        // Still return 200 to acknowledge receipt
        return new Response("Shop redaction acknowledged with errors", {
          status: 200,
        });
      }
    }

    default:
      console.log(`[Webhook] Unhandled topic: ${topic}`);
      return new Response("Webhook received", { status: 200 });
  }
};
