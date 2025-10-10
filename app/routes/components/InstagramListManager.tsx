import { useFetcher } from "@remix-run/react";
import { Button, Card, Text, Banner, List, Checkbox } from "@shopify/polaris";
import { useState, useEffect } from "react";

export function InstagramListManager() {
  const listsFetcher = useFetcher<any>();
  const createFetcher = useFetcher<any>();
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
  const [listName, setListName] = useState("");

  useEffect(() => {
    // Load existing lists on component mount
    listsFetcher.load("/api/instagram/lists");
  }, []);

  const handleCreateList = () => {
    if (selectedPosts.length === 0) return;
    
    createFetcher.submit(
      { 
        action: "create",
        listName: listName || `Instagram List ${Date.now()}`,
        postMetaobjectIds: selectedPosts
      },
      {
        method: "POST",
        action: "/api/instagram/lists",
        encType: "application/json"
      }
    );
  };

  const lists = listsFetcher.data?.lists || [];
  const createResult = createFetcher.data;

  return (
    <Card>
      <div style={{ padding: "1rem" }}>
        <Text variant="headingMd" as="h3">Instagram Lists Manager</Text>
        
        <div style={{ marginTop: "1rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <Button 
            onClick={() => listsFetcher.load("/api/instagram/lists")}
            loading={listsFetcher.state !== "idle"}
          >
            Refresh Lists
          </Button>
          
          {selectedPosts.length > 0 && (
            <>
              <input
                type="text"
                placeholder="List name (optional)"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                style={{ 
                  padding: "8px", 
                  border: "1px solid #ccc", 
                  borderRadius: "4px",
                  minWidth: "200px"
                }}
              />
              <Button 
                variant="primary"
                onClick={handleCreateList}
                loading={createFetcher.state !== "idle"}
              >
                Create List with {selectedPosts.length.toString()} Posts
              </Button>
            </>
          )}
        </div>

        {/* Creation Results */}
        {createResult && (
          <div style={{ marginTop: "1rem" }}>
            {createResult.success ? (
              <Banner tone="success">
                {createResult.message}
              </Banner>
            ) : (
              <Banner tone="critical" title="Failed to create list">
                {createResult.error || "Unknown error"}
              </Banner>
            )}
          </div>
        )}

        {/* Existing Lists */}
        {lists.length > 0 && (
          <div style={{ marginTop: "2rem" }}>
            <Text variant="headingSm" as="h4">Existing Instagram Lists</Text>
            <div style={{ 
              display: "grid", 
              gap: "1rem", 
              marginTop: "1rem"
            }}>
              {lists.map((listEdge: any) => {
                const list = listEdge.node;
                const postReferences = list.fields.find((f: any) => f.key === "post_reference");
                const referencedPosts = postReferences?.references?.edges || [];
                
                return (
                  <Card key={list.id}>
                    <div style={{ padding: "1rem" }}>
                      <Text variant="bodyMd" fontWeight="semibold" as="p">
                        {list.handle}
                      </Text>
                      <Text variant="bodySm" as="p" tone="subdued">
                        ID: {list.id}
                      </Text>
                      <Text variant="bodySm" as="p">
                        Contains {referencedPosts.length} Instagram posts
                      </Text>
                      
                      {referencedPosts.length > 0 && (
                        <div style={{ marginTop: "0.5rem" }}>
                          <Text variant="bodySm" as="p">Referenced Posts:</Text>
                          <div style={{ fontSize: "0.8rem", color: "#666" }}>
                            {referencedPosts.slice(0, 3).map((postEdge: any, idx: number) => (
                              <div key={idx}>• {postEdge.node.handle || postEdge.node.id}</div>
                            ))}
                            {referencedPosts.length > 3 && (
                              <div>... and {referencedPosts.length - 3} more</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Available Posts for Selection */}
        <AvailablePostsSelector 
          selectedPosts={selectedPosts}
          onSelectionChange={setSelectedPosts}
        />
      </div>
    </Card>
  );
}

// Component to select available Instagram posts
function AvailablePostsSelector({ 
  selectedPosts, 
  onSelectionChange 
}: { 
  selectedPosts: string[];
  onSelectionChange: (posts: string[]) => void;
}) {
  const postsFetcher = useFetcher<any>();

  useEffect(() => {
    // Load available Instagram posts
    postsFetcher.submit(
      {},
      {
        method: "GET",
        action: "/api/admin/metaobjects?type=$app:instagram_post"
      }
    );
  }, []);

  const handlePostToggle = (postId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedPosts, postId]);
    } else {
      onSelectionChange(selectedPosts.filter(id => id !== postId));
    }
  };

  return (
    <div style={{ marginTop: "2rem" }}>
      <Text variant="headingSm" as="h4">Select Posts for New List</Text>
      <Text variant="bodySm" as="p" tone="subdued">
        Choose Instagram posts to include in a new list
      </Text>
      
      {/* This would need to be implemented to fetch actual metaobjects */}
      <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#f9f9f9", borderRadius: "8px" }}>
        <Text variant="bodySm" as="p">
          📝 Note: Post selection will be available once you have uploaded Instagram posts. 
          Use the Instagram Posts Manager to upload posts first, then return here to create lists.
        </Text>
      </div>
    </div>
  );
}
