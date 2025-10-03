import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Card, Page, Layout, Text, List, Banner, Button } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { session } = await authenticate.admin(request);
    
    // Get social accounts for this shop
    const socialAccounts = await prisma.socialAccount.findMany({
      where: {
        shop: session.shop
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return Response.json({
      success: true,
      shop: session.shop,
      socialAccounts,
      error: null,
    });
  } catch (error) {
    console.error("Social status error:", error);
    return Response.json({
      success: false,
      shop: null,
      socialAccounts: [],
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export default function SocialStatus() {
  const data = useLoaderData<typeof loader>();

  const getStatusColor = (account: any) => {
    if (!account.expiresAt) return "warning";
    const now = new Date();
    const expires = new Date(account.expiresAt);
    const daysUntilExpiry = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 7) return "critical";
    if (daysUntilExpiry < 30) return "warning"; 
    return "success";
  };

  const formatExpiryDate = (expiresAt: string | null) => {
    if (!expiresAt) return "No expiration";
    const date = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    return `${date.toLocaleDateString()} (${daysUntilExpiry} days)`;
  };

  return (
    <Page title="Social Media Status">
      <Layout>
        <Layout.Section>
          {data.success ? (
            <Banner tone="success">
              <p>Connected to shop: <strong>{data.shop}</strong></p>
            </Banner>
          ) : (
            <Banner tone="critical">
              <p>❌ Authentication failed: {data.error}</p>
            </Banner>
          )}
        </Layout.Section>

        {data.success && (
          <Layout.Section>
            <Card>
              <div style={{ padding: "1rem" }}>
                <Text variant="headingMd" as="h3">
                  Connected Social Accounts
                </Text>
                
                {data.socialAccounts.length === 0 ? (
                  <div style={{ marginTop: "1rem", textAlign: "center", padding: "2rem" }}>
                    <Text variant="bodyMd" as="p" tone="subdued">
                      No social accounts connected yet.
                    </Text>
                    <div style={{ marginTop: "1rem", display: "flex", gap: "1rem", justifyContent: "center" }}>
                      <Button onClick={() => window.open("/app/facebook", "_parent")}>
                        Connect Facebook
                      </Button>
                      <Button onClick={() => window.open("/app/instagram", "_parent")}>
                        Connect Instagram
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: "1rem" }}>
                    {data.socialAccounts.map((account : any) => (
                      <div key={account!.id} style={{ marginBottom: "1rem" }}>
                        <Card>
                          <div style={{ padding: "1rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                              <Text variant="headingSm" as="h4">
                                {account!.provider.charAt(0).toUpperCase() + account!.provider.slice(1)}
                              </Text>
                              <Banner tone={getStatusColor(account)}>
                                {getStatusColor(account) === "success" ? "Active" : 
                                 getStatusColor(account) === "warning" ? "Expiring Soon" : "Critical"}
                              </Banner>
                            </div>
                            <List>
                              <List.Item>
                                <strong>User ID:</strong> {account!.userId || "N/A"}
                              </List.Item>
                              <List.Item>
                                <strong>Connected:</strong> {new Date(account!.createdAt).toLocaleDateString()}
                              </List.Item>
                              <List.Item>
                                <strong>Last Updated:</strong> {new Date(account!.updatedAt).toLocaleDateString()}
                              </List.Item>
                              <List.Item>
                                <strong>Expires:</strong> {formatExpiryDate(account!.expiresAt)}
                              </List.Item>
                              <List.Item>
                                <strong>Token Status:</strong> {account!.accessToken ? "Present" : "Missing"}
                              </List.Item>
                            </List>
                          </div>
                        </Card>
                      </div>
                    ))}
                    
                    <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem" }}>
                      <Button onClick={() => window.open("/app/facebook", "_parent")}>
                        Reconnect Facebook
                      </Button>
                      <Button onClick={() => window.open("/app/instagram", "_parent")}>
                        Reconnect Instagram  
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
