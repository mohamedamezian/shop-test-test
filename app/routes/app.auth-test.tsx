import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Card, Page, Layout, Text, Banner, List } from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.admin(request);
    
    // Get shop information to verify authentication
    const shopQuery = `
      query {
        shop {
          id
          name
          email
          myshopifyDomain
          plan {
            displayName
          }
          currencyCode
        }
      }
    `;

    const response = await admin.graphql(shopQuery);
    const shopData = await response.json();

    return json({
      success: true,
      session: {
        id: session.id,
        shop: session.shop,
        accessToken: session.accessToken ? "Present" : "Missing",
        scope: session.scope,
        isOnline: session.isOnline,
      },
      shopInfo: shopData.data?.shop || null,
      error: null,
    });
  } catch (error) {
    console.error("Authentication test error:", error);
    return json({
      success: false,
      session: null,
      shopInfo: null,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export default function AuthTest() {
  const data = useLoaderData<typeof loader>();

  return (
    <Page title="Authentication Test">
      <Layout>
        <Layout.Section>
          {data.success ? (
            <Banner tone="success">
              <p>Authentication successful!</p>
            </Banner>
          ) : (
            <Banner tone="critical">
              <p>❌ Authentication failed: {data.error}</p>
            </Banner>
          )}
        </Layout.Section>

        {data.success && data.session && (
          <Layout.Section>
            <Card>
              <div style={{ padding: "1rem" }}>
                <Text variant="headingMd" as="h3">
                  Session Details
                </Text>
                <div style={{ marginTop: "1rem" }}>
                  <List>
                    <List.Item>
                      <strong>Session ID:</strong> {data.session.id}
                    </List.Item>
                    <List.Item>
                      <strong>Shop:</strong> {data.session.shop}
                    </List.Item>
                    <List.Item>
                      <strong>Access Token:</strong> {data.session.accessToken}
                    </List.Item>
                    <List.Item>
                      <strong>Scope:</strong> {data.session.scope}
                    </List.Item>
                    <List.Item>
                      <strong>Is Online:</strong> {data.session.isOnline ? "Yes" : "No"}
                    </List.Item>
                  </List>
                </div>
              </div>
            </Card>
          </Layout.Section>
        )}

        {data.success && data.shopInfo && (
          <Layout.Section>
            <Card>
              <div style={{ padding: "1rem" }}>
                <Text variant="headingMd" as="h3">
                  Shop Information
                </Text>
                <div style={{ marginTop: "1rem" }}>
                  <List>
                    <List.Item>
                      <strong>Shop ID:</strong> {data.shopInfo.id}
                    </List.Item>
                    <List.Item>
                      <strong>Name:</strong> {data.shopInfo.name}
                    </List.Item>
                    <List.Item>
                      <strong>Email:</strong> {data.shopInfo.email}
                    </List.Item>
                    <List.Item>
                      <strong>Domain:</strong> {data.shopInfo.myshopifyDomain}
                    </List.Item>
                    <List.Item>
                      <strong>Plan:</strong> {data.shopInfo.plan?.displayName}
                    </List.Item>
                    <List.Item>
                      <strong>Currency:</strong> {data.shopInfo.currencyCode}
                    </List.Item>
                  </List>
                </div>
              </div>
            </Card>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <div style={{ padding: "1rem" }}>
              <Text variant="headingMd" as="h3">
                Test Admin API Call
              </Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                This test verifies that your app can successfully authenticate and make API calls to Shopify.
                The session details above show the authentication state, and the shop information confirms
                that API calls are working properly.
              </Text>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
