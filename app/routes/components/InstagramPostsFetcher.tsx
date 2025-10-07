import { Card, Text, List } from "@shopify/polaris";

interface InstagramPost {
  id: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  caption?: string;
  timestamp: string;
}

interface InstagramPostsProps {
  posts: InstagramPost[];
  error?: string;
}

export function InstagramPostsDisplay({ posts, error }: InstagramPostsProps) {
  return (
    <Card>
      <div style={{ padding: "1rem" }}>
        <Text variant="headingMd" as="h3">
          Instagram Posts (Server-side rendered)
        </Text>

        {error && (
          <div style={{ marginTop: "1rem", color: "red" }}>
            Error: {error}
          </div>
        )}

        {posts && posts.length > 0 && (
          <div style={{ marginTop: "1rem" }}>
            <Text variant="headingSm" as="h4">
              Found {posts.length} posts
            </Text>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
              {posts.slice(0, 6).map((post) => (
                <Card key={post.id}>
                  <div style={{ padding: "0.5rem" }}>
                    {post.media_type === "IMAGE" && post.media_url && (
                      <div style={{ position: "relative", width: "100%", height: "150px", backgroundColor: "#f5f5f5", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <img 
                          src={post.media_url} 
                          alt={post.caption || "Instagram post"} 
                          style={{ 
                            width: "100%", 
                            height: "150px", 
                            objectFit: "cover", 
                            borderRadius: "4px",
                            position: "absolute",
                            top: 0,
                            left: 0
                          }}
                          loading="eager"
                          onLoad={(e) => {
                            (e.target as HTMLImageElement).style.opacity = "1";
                          }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                        <div style={{ color: "#999", fontSize: "12px" }}>Loading...</div>
                      </div>
                    )}
                    <div style={{ marginTop: "0.5rem" }}>
                      <Text variant="bodyMd" as="p">
                        <strong>{post.media_type}</strong>
                      </Text>
                      <Text variant="bodySm" as="p" tone="subdued">
                        {new Date(post.timestamp).toLocaleDateString()}
                      </Text>
                    </div>
                    {post.caption && (
                      <div style={{ marginTop: "0.5rem" }}>
                        <Text variant="bodySm" as="p">
                          {post.caption.substring(0, 80)}...
                        </Text>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {posts && posts.length === 0 && (
          <div style={{ marginTop: "1rem", textAlign: "center", color: "#666" }}>
            No Instagram posts found
          </div>
        )}
      </div>
    </Card>
  );
}
