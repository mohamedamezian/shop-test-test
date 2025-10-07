import { useFetcher } from "@remix-run/react";

interface InstagramPost {
  id: string;
  media_type: string;
  caption?: string;
  timestamp: string;
}

interface InstagramApiResponse {
  success: boolean;
  posts: InstagramPost[];
  error?: string;
}

export function SimpleInstagramFetcher() {
  const fetcher = useFetcher<InstagramApiResponse>();

  const loadPosts = () => {
    fetcher.load("/api/instagram/posts");
  };

  return (
    <div style={{ padding: "1rem", border: "1px solid #ccc", borderRadius: "8px" }}>
      <h3>Instagram Posts (Simple Version)</h3>
      
      <button 
        onClick={loadPosts} 
        disabled={fetcher.state === "loading"}
        style={{ padding: "0.5rem 1rem", marginRight: "0.5rem" }}
      >
        {fetcher.state === "loading" ? "Loading..." : "Load Posts"}
      </button>

      {fetcher.data?.error && (
        <div style={{ marginTop: "1rem", color: "red" }}>
          Error: {fetcher.data.error}
        </div>
      )}

      {fetcher.data?.success && fetcher.data.posts && (
        <div style={{ marginTop: "1rem" }}>
          <p>Found {fetcher.data.posts.length} posts</p>
          {fetcher.data.posts.slice(0, 3).map((post: InstagramPost) => (
            <div key={post.id} style={{ marginBottom: "0.5rem", padding: "0.5rem", backgroundColor: "#f5f5f5" }}>
              <strong>{post.media_type}</strong> - {new Date(post.timestamp).toLocaleDateString()}
              {post.caption && (
                <div style={{ fontSize: "0.9em", color: "#666" }}>
                  {post.caption.substring(0, 100)}...
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
