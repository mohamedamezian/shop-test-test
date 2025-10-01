import { AppProvider, Card, Text, Badge, Divider } from "@shopify/polaris";
import translations from "@shopify/polaris/locales/en.json";
import { FacebookConnectButton } from "../components/FacebookConnectButton";
import { InstagramConnectButton } from "../components/InstagramConnectButton";
import { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "app/shopify.server";
import prisma from "app/db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  // Check Instagram connection status
  const instagramAccount = await prisma.socialAccount.findUnique({
    where: {
      shop_provider: {
        shop: session.shop,
        provider: "instagram"
      }
    }
  });

  // Check Facebook connection status  
  const facebookAccount = await prisma.socialAccount.findUnique({
    where: {
      shop_provider: {
        shop: session.shop,
        provider: "facebook"
      }
    }
  });

  return { 
    shop: session.shop, 
    instagram: instagramAccount,
    facebook: facebookAccount
  };
};

export default function Index() {
  const { shop, instagram, facebook } = useLoaderData<typeof loader>();
  
  return (
    <AppProvider i18n={translations}>
      <div style={{ padding: "2rem" }}>
        <h1>Welcome to your app 🎉</h1>
        
        <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem" }}>
          <InstagramConnectButton />
          <FacebookConnectButton />
        </div>

        <Divider />

        <Card>
          <div style={{ padding: "1rem" }}>
            <Text variant="headingMd" as="h2">Connection Status</Text>
            
            <div style={{ marginTop: "1rem" }}>
              <Text variant="bodyMd" as="p">
                <strong>Instagram:</strong>{" "}
                {instagram ? (
                  <>
                    <Badge tone="success">✅ Connected</Badge>
                    <br />
                    <Text variant="bodySm" tone="subdued" as="span">
                      User ID: {instagram.userId || "Unknown"}<br />
                      Expires: {instagram.expiresAt ? new Date(instagram.expiresAt).toLocaleDateString() : "Never"}<br />
                      Connected: {instagram.createdAt ? new Date(instagram.createdAt).toLocaleDateString() : "Unknown"}
                    </Text>
                  </>
                ) : (
                  <Badge tone="critical">❌ Not connected</Badge>
                )}
              </Text>
            </div>

            <div style={{ marginTop: "1rem" }}>
              <Text variant="bodyMd" as="p">
                <strong>Facebook:</strong>{" "}
                {facebook ? (
                  <>
                    <Badge tone="success">✅ Connected</Badge>
                    <br />
                    <Text variant="bodySm" tone="subdued" as="span">
                      User ID: {facebook.userId || "Unknown"}<br />
                      Expires: {facebook.expiresAt ? new Date(facebook.expiresAt).toLocaleDateString() : "Never"}<br />
                      Connected: {facebook.createdAt ? new Date(facebook.createdAt).toLocaleDateString() : "Unknown"}
                    </Text>
                  </>
                ) : (
                  <Badge tone="critical">❌ Not connected</Badge>
                )}
              </Text>
            </div>
          </div>
        </Card>
      </div>
    </AppProvider>
  );
}
