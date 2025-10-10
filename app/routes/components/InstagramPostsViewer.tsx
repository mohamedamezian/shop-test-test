import { useFetcher } from "@remix-run/react";
import { Button, Card, Text, Checkbox, Banner, Spinner } from "@shopify/polaris";
import { useState } from "react";

export function InstagramPostsViewer() {
  const fetcher = useFetcher<any>();
  const uploadFetcher = useFetcher<any>();
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);

  const handlePostSelection = (postId: string, checked: boolean) => {
    setSelectedPosts(prev => 
      checked 
        ? [...prev, postId]
        : prev.filter(id => id !== postId)
    );
  };

  const handleUploadSelected = () => {
    if (selectedPosts.length === 0) return;
    
    uploadFetcher.submit(
      { postIds: selectedPosts },
      {
        method: "POST",
        action: "/api/instagram/posts",
        encType: "application/json"
      }
    );
  };

  const isUploading = uploadFetcher.state !== "idle";
  const posts = fetcher.data?.posts || [];
  const uploadResult = uploadFetcher.data;

  return (
    <Card>
      <div style={{ padding: "1rem" }}>
        <Text variant="headingMd" as="h3">Instagram Posts Manager</Text>
        
        <div style={{ marginTop: "1rem", display: "flex", gap: "1rem" }}>
          <Button 
            onClick={() => fetcher.load("/api/instagram/posts")} 
            loading={fetcher.state !== "idle"}
          >
            Load Posts
          </Button>
          
          {selectedPosts.length > 0 && (
            <Button 
              variant="primary"
              onClick={handleUploadSelected}
              loading={isUploading}
            >
              Upload {selectedPosts.length.toString()} to Shopify
            </Button>
          )}
        </div>

        {/* Upload Results */}
        {uploadResult && (
          <div style={{ marginTop: "1rem" }}>
            {uploadResult.success && (
              <Banner tone="success">
                {uploadResult.summary} - Files uploaded to Shopify!
              </Banner>
            )}
            
            {uploadResult.errors && uploadResult.errors.length > 0 && (
              <Banner tone="warning" title="Some uploads failed:">
                <ul>
                  {uploadResult.errors.map((error: string, index: number) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </Banner>
            )}
            
            {uploadResult.uploadedFiles && uploadResult.uploadedFiles.length > 0 && (
              <div style={{ marginTop: "1rem" }}>
                <Text variant="headingSm" as="h4">Uploaded Files:</Text>
                {uploadResult.uploadedFiles.map((file: any) => (
                  <p key={file.postId} style={{ fontSize: "0.9rem", color: "#666" }}>
                    ✅ Post {file.postId} → {file.shopifyUrl}
                    {file.metaobjectId && (
                      <span style={{ display: "block", fontSize: "0.8rem", color: "#999" }}>
                        Metaobject: {file.metaobjectId}
                      </span>
                    )}
                  </p>
                ))}
                
                {uploadResult.createdList && (
                  <div style={{ marginTop: "1rem", padding: "0.5rem", backgroundColor: "#e8f5e8", borderRadius: "4px" }}>
                    <Text variant="bodySm" as="p" fontWeight="semibold">
                      📋 Auto-created Instagram List: {uploadResult.createdList.handle}
                    </Text>
                    <Text variant="bodySm" as="p" tone="subdued">
                      ID: {uploadResult.createdList.id}
                    </Text>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Loading Indicator */}
        {isUploading && (
          <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Spinner size="small" />
            <Text as="span">Uploading images to Shopify...</Text>
          </div>
        )}

        {/* Error Display */}
        {fetcher.data?.error && (
          <Banner tone="critical" title="Error loading posts:">
            {fetcher.data.error}
          </Banner>
        )}

        {/* Posts Grid */}
        {posts.length > 0 && (
          <div style={{ marginTop: "1rem" }}>
            <Text variant="bodySm" as="p" tone="subdued">
              {posts.length} posts found. Select posts to upload to Shopify:
            </Text>
            
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", 
              gap: "1rem", 
              marginTop: "1rem" 
            }}>
              {posts.map((post: any) => (
                <Card key={post.id}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", padding: "1rem" }}>
                    <Checkbox
                      label=""
                      checked={selectedPosts.includes(post.id)}
                      onChange={(checked) => handlePostSelection(post.id, checked)}
                      disabled={isUploading}
                    />
                    
                    <div style={{ flex: 1 }}>
                      {post.media_type === "IMAGE" && post.media_url && (
                        <img 
                          src={post.media_url} 
                          alt="Instagram post" 
                          style={{ 
                            width: "100%", 
                            maxWidth: "200px", 
                            height: "150px", 
                            objectFit: "cover",
                            borderRadius: "8px"
                          }} 
                        />
                      )}
                      
                      <div style={{ marginTop: "0.5rem" }}>
                        <Text variant="bodyMd" fontWeight="semibold" as="p">
                          {new Date(post.timestamp).toLocaleDateString()}
                        </Text>
                        
                        {post.caption && (
                          <p style={{ 
                            marginTop: "0.25rem", 
                            fontSize: "0.9rem", 
                            color: "#666",
                            lineHeight: "1.4"
                          }}>
                            {post.caption.length > 100 
                              ? post.caption.substring(0, 100) + "..." 
                              : post.caption
                            }
                          </p>
                        )}
                        
                        <Text variant="bodySm" as="p" tone="subdued">
                          ID: {post.id}
                        </Text>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
