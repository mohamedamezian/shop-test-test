import { useFetcher } from "@remix-run/react";
import { Button, Card, Text } from "@shopify/polaris";

export function InstagramPostsViewer() {
  const fetcher = useFetcher<any>();

  return (
    <Card>
      <div style={{ padding: "1rem" }}>
        <Text variant="headingMd" as="h3">Instagram Posts</Text>
        
        <div style={{ marginTop: "1rem" }}>
          <Button onClick={() => fetcher.load("/api/instagram/posts")} loading={fetcher.state !== "idle"}>
            Load Posts
          </Button>
        </div>

        {fetcher.data?.error && (
          <p style={{ color: "red", marginTop: "1rem" }}>{fetcher.data.error}</p>
        )}

        {fetcher.data?.posts && (
          <div style={{ marginTop: "1rem" }}>
            <p>{fetcher.data.posts.length} posts found</p>
            <div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
              {fetcher.data.posts.slice(0, 4).map((post: any) => (
                <div key={post.id} style={{ border: "1px solid #ccc", padding: "0.5rem" }}>
                  {post.media_type === "IMAGE" && (
                    <img src={post.media_url} alt="" style={{ width: "100px", height: "100px" }} />
                  )}
                  <p><strong>{new Date(post.timestamp).toLocaleDateString()}</strong></p>
                  {post.caption && <p>{post.caption.substring(0, 50)}...</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
