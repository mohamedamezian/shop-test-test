import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Card, Page, Layout, Text, Banner } from "@shopify/polaris";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Get all social accounts to debug
    const allAccounts = await prisma.socialAccount.findMany({
      orderBy: { createdAt: 'desc' }
    });

    // Get environment variables (safely)
    const envVars = {
      INSTAGRAM_REDIRECT_URI: process.env.INSTAGRAM_REDIRECT_URI,
      FACEBOOK_REDIRECT_URI: process.env.FACEBOOK_REDIRECT_URI,
      INSTAGRAM_APP_ID: process.env.INSTAGRAM_APP_ID ? "Present" : "Missing",
      FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID ? "Present" : "Missing",
    };

    return json({
      success: true,
      allAccounts,
      envVars,
      error: null,
    });
  } catch (error) {
    console.error("Debug error:", error);
    return json({
      success: false,
      allAccounts: [],
      envVars: {},
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export default function DebugPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <Page title="Debug Information">
      <Layout>
        <Layout.Section>
          {data.success ? (
            <Banner tone="success">
              <p>✅ Debug data loaded successfully</p>
            </Banner>
          ) : (
            <Banner tone="critical">
              <p>❌ Error loading debug data: {data.error}</p>
            </Banner>
          )}
        </Layout.Section>

        {data.success && (
          <>
            <Layout.Section>
              <Card>
                <div style={{ padding: "1rem" }}>
                  <Text variant="headingMd" as="h3">
                    Environment Configuration
                  </Text>
                  <div style={{ marginTop: "1rem", fontFamily: "monospace", fontSize: "12px" }}>
                    <pre>{JSON.stringify(data.envVars, null, 2)}</pre>
                  </div>
                </div>
              </Card>
            </Layout.Section>

            <Layout.Section>
              <Card>
                <div style={{ padding: "1rem" }}>
                  <Text variant="headingMd" as="h3">
                    All Social Accounts in Database
                  </Text>
                  {data.allAccounts.length === 0 ? (
                    <Text variant="bodyMd" as="p" tone="subdued">
                      No social accounts found in database.
                    </Text>
                  ) : (
                    <div style={{ marginTop: "1rem", fontFamily: "monospace", fontSize: "12px" }}>
                      <pre>{JSON.stringify(data.allAccounts, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </Card>
            </Layout.Section>
          </>
        )}
      </Layout>
    </Page>
  );
}
