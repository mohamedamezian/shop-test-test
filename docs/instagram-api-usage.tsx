// Example: How to use the Instagram Posts API

// 🔥 METHOD 1: Using useFetcher (Recommended for Remix)
import { useFetcher } from "@remix-run/react";
import { Button } from "@shopify/polaris";

export function InstagramApiExample() {
  const fetcher = useFetcher<any>();
  const uploadFetcher = useFetcher<any>();

  // Load Instagram posts
  const loadPosts = () => {
    fetcher.load("/api/instagram/posts");
  };

  // Upload specific posts to Shopify
  const uploadPosts = (postIds: string[]) => {
    uploadFetcher.submit(
      { postIds },
      {
        method: "POST",
        action: "/api/instagram/posts",
        encType: "application/json"
      }
    );
  };

  return (
    <div>
      <Button onClick={loadPosts}>Load Posts</Button>
      
      {fetcher.data?.posts && (
        <div>
          {fetcher.data.posts.map((post: any) => (
            <div key={post.id}>
              <img src={post.media_url} alt="" />
              <Button onClick={() => uploadPosts([post.id])}>
                Upload This Post
              </Button>
            </div>
          ))}
        </div>
      )}
      
      {uploadFetcher.data?.success && (
        <p>✅ Upload successful!</p>
      )}
    </div>
  );
}

// 🔥 METHOD 2: Using standard fetch (for client-side operations)
export async function fetchInstagramPosts() {
  try {
    const response = await fetch('/api/instagram/posts');
    const data = await response.json();
    
    if (data.error) {
      console.error('Error:', data.error);
      return { posts: [], error: data.error };
    }
    
    return { posts: data.posts, error: null };
  } catch (error) {
    console.error('Fetch error:', error);
    return { posts: [], error: 'Failed to fetch posts' };
  }
}

export async function uploadPostsToShopify(postIds: string[]) {
  try {
    const response = await fetch('/api/instagram/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ postIds }),
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Upload error:', error);
    return { success: false, error: 'Upload failed' };
  }
}

// 🔥 METHOD 3: Complete example with React hooks
import { useState, useEffect } from "react";

export function CompleteInstagramManager() {
  const [posts, setPosts] = useState([]);
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);

  // Load posts on component mount
  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    const { posts, error } = await fetchInstagramPosts();
    if (!error) {
      setPosts(posts);
    }
  };

  const handleUpload = async () => {
    if (selectedPosts.length === 0) return;
    
    setUploading(true);
    const result = await uploadPostsToShopify(selectedPosts);
    setUploadResults(result);
    setUploading(false);
    
    // Clear selection after upload
    if (result.success) {
      setSelectedPosts([]);
    }
  };

  return (
    <div>
      <h2>Instagram Posts Manager</h2>
      
      <Button onClick={loadPosts}>Refresh Posts</Button>
      
      {selectedPosts.length > 0 && (
        <Button 
          variant="primary" 
          onClick={handleUpload}
          loading={uploading}
        >
          Upload {selectedPosts.length} Posts to Shopify
        </Button>
      )}
      
      {uploadResults?.success && (
        <div style={{ color: 'green' }}>
          ✅ {uploadResults.summary}
        </div>
      )}
      
      <div style={{ display: 'grid', gap: '1rem' }}>
        {posts.map((post: any) => (
          <div key={post.id}>
            <input
              type="checkbox"
              checked={selectedPosts.includes(post.id)}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedPosts([...selectedPosts, post.id]);
                } else {
                  setSelectedPosts(selectedPosts.filter(id => id !== post.id));
                }
              }}
            />
            <img src={post.media_url} alt="" style={{ width: '200px' }} />
            <p>{post.caption}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
