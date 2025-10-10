import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Card, Page, Layout, Text, Banner, Button } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { useFetcher } from "@remix-run/react";
import prisma from "../db.server";
import { InstagramPostsViewer } from "./components/InstagramPostsViewer";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { session } = await authenticate.admin(request);
    
    // Get Instagram token for this shop
    const instagramAccount = await prisma.socialAccount.findUnique({
      where: {
        shop_provider: {
          shop: session.shop,
          provider: "instagram"
        }
      }
    });

    if (!instagramAccount || !instagramAccount.accessToken) {
      return {
        success: false,
        error: "No Instagram account connected",
        posts: []
      };
    }

    // Test Instagram API call - get user's media
    const instagramResponse = await fetch(
      `https://graph.instagram.com/me/media?fields=id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,username&access_token=${instagramAccount.accessToken}`
    );

    const instagramData = await instagramResponse.json();

    if (!instagramResponse.ok) {
      return{
        success: false,
        error: `Instagram API error: ${instagramData.error?.message || 'Unknown error'}`,
        posts: []
      };
    }

    return {
      success: true,
      error: null,
      posts: instagramData.data || [],
      user: instagramAccount.userId,
      tokenExpires: instagramAccount.expiresAt
    };

  } catch (error) {
    console.error("Instagram test error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      posts: []
    };
  }
};

export default function InstagramTest() {
  const data = useLoaderData<typeof loader>();
  const debugFetcher = useFetcher<any>();
  const testFetcher = useFetcher<any>();

  const checkMetaobjects = () => {
    debugFetcher.load("/api/debug/metaobjects");
  };

  const testListCreation = () => {
    testFetcher.submit({}, {
      method: "POST",
      action: "/api/test/list-creation"
    });
  };

  return (
    <Page title="Instagram API Test">
      <Layout>
        <Layout.Section>
          <Card>
            <div style={{ padding: "1rem" }}>
              <Text variant="headingMd" as="h3">Debug Metaobjects</Text>
              <div style={{ marginTop: "1rem", display: "flex", gap: "1rem" }}>
                <Button 
                  onClick={checkMetaobjects}
                  loading={debugFetcher.state !== "idle"}
                >
                  Check Existing Metaobjects
                </Button>
                <Button 
                  onClick={testListCreation}
                  loading={testFetcher.state !== "idle"}
                  variant="secondary"
                >
                  Test List Creation
                </Button>
              </div>
              
              {debugFetcher.data && (
                <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#f9f9f9", borderRadius: "8px" }}>
                  <Text variant="bodyMd" fontWeight="semibold" as="p">
                    Instagram Posts: {debugFetcher.data.postsCount}
                  </Text>
                  <Text variant="bodyMd" fontWeight="semibold" as="p">
                    Instagram Lists: {debugFetcher.data.listsCount}
                  </Text>
                  
                  {debugFetcher.data.error && (
                    <Text variant="bodySm" as="p" tone="critical">
                      Error: {debugFetcher.data.error}
                    </Text>
                  )}
                  
                  <details style={{ marginTop: "0.5rem" }}>
                    <summary style={{ cursor: "pointer" }}>View Debug Data</summary>
                    <pre style={{ fontSize: "0.8rem", overflow: "auto", maxHeight: "300px" }}>
                      {JSON.stringify(debugFetcher.data, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
              
              {testFetcher.data && (
                <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#f0f8ff", borderRadius: "8px" }}>
                  <Text variant="bodyMd" fontWeight="semibold" as="p">
                    List Creation Test Results:
                  </Text>
                  <Text variant="bodySm" as="p">
                    Success: {testFetcher.data.success ? "✅" : "❌"}
                  </Text>
                  
                  <details style={{ marginTop: "0.5rem" }}>
                    <summary style={{ cursor: "pointer" }}>View Test Results</summary>
                    <pre style={{ fontSize: "0.8rem", overflow: "auto", maxHeight: "300px" }}>
                      {JSON.stringify(testFetcher.data, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <InstagramPostsViewer />
        </Layout.Section>
      </Layout>
    </Page>
  );
}
