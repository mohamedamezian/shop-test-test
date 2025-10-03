import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Card, Page, Layout, Text, Banner } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

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
      return json({
        success: false,
        error: "No Instagram account connected",
        posts: []
      });
    }

    // Test Instagram API call - get user's media
    const instagramResponse = await fetch(
      `https://graph.instagram.com/me/media?fields=id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,username&access_token=${instagramAccount.accessToken}`
    );

    const instagramData = await instagramResponse.json();

    if (!instagramResponse.ok) {
      return json({
        success: false,
        error: `Instagram API error: ${instagramData.error?.message || 'Unknown error'}`,
        posts: []
      });
    }

    return json({
      success: true,
      error: null,
      posts: instagramData.data || [],
      user: instagramAccount.userId,
      tokenExpires: instagramAccount.expiresAt
    });

  } catch (error) {
    console.error("Instagram test error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      posts: []
    });
  }
};

export default function InstagramTest() {
  const data = useLoaderData<typeof loader>();

  return (
    <Page title="Instagram API Test">
      <Layout>
        <Layout.Section>
          {data.success ? (
            <Banner tone="success">
              <p>✅ Instagram API working! Found {data.posts.length} posts</p>
            </Banner>
          ) : (
            <Banner tone="critical">
              <p>❌ Error: {data.error}</p>
            </Banner>
          )}
        </Layout.Section>

        {data.success && (
          <>
            <Layout.Section>
              <Card>
                <div style={{ padding: "1rem" }}>
                  <Text variant="headingMd" as="h3">
                    Account Info
                  </Text>
                  <p><strong>User ID:</strong> {'user' in data ? data.user : 'Unknown'}</p>
                  <p><strong>Token Expires:</strong> {'tokenExpires' in data && data.tokenExpires ? new Date(data.tokenExpires).toLocaleString() : 'Unknown'}</p>
                  <p><strong>Posts Found:</strong> {data.posts.length}</p>
                </div>
              </Card>
            </Layout.Section>

            {data.posts.length > 0 && (
              <Layout.Section>
                <Card>
                  <div style={{ padding: "1rem" }}>
                    <Text variant="headingMd" as="h3">
                      Recent Posts
                    </Text>
                    <div style={{ marginTop: "1rem" }}>
                      {data.posts.slice(0, 5).map((post: any) => (
                        <div key={post.id} style={{ 
                          marginBottom: "1rem", 
                          padding: "1rem", 
                          border: "1px solid #e1e1e1", 
                          borderRadius: "8px" 
                        }}>
                          <p><strong>Type:</strong> {post.media_type}</p>
                          <p><strong>Posted:</strong> {new Date(post.timestamp).toLocaleString()}</p>
                          {post.caption && (
                            <p><strong>Caption:</strong> {post.caption.substring(0, 100)}...</p>
                          )}
                          <p><strong>ID:</strong> {post.id}</p>
                          {post.media_url && post.media_type === 'IMAGE' && (
                            <img 
                              src={post.media_url} 
                              alt="Instagram post"
                              style={{ maxWidth: "200px", marginTop: "0.5rem" }}
                            />
                          )}
                          <p>
                            <a href={post.permalink} target="_blank" rel="noopener noreferrer">
                              View on Instagram
                            </a>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </Layout.Section>
            )}
          </>
        )}
      </Layout>
    </Page>
  );
}
