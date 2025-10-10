import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  try {
    // Check Instagram posts
    const postsResponse = await admin.graphql(
      `#graphql
      query getInstagramPosts {
        metaobjects(type: "$app:instagram_post", first: 10) {
          edges {
            node {
              id
              handle
              updatedAt
              fields {
                key
                value
              }
            }
          }
        }
      }`
    );

    const postsResult = await postsResponse.json();

    // Check Instagram lists
    const listsResponse = await admin.graphql(
      `#graphql
      query getInstagramLists {
        metaobjects(type: "$app:instagram_list", first: 10) {
          edges {
            node {
              id
              handle
              updatedAt
              fields {
                key
                value
                references(first: 10) {
                  edges {
                    node {
                      ... on Metaobject {
                        id
                        handle
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }`
    );

    const listsResult = await listsResponse.json();

    return json({
      posts: postsResult.data?.metaobjects?.edges || [],
      lists: listsResult.data?.metaobjects?.edges || [],
      postsCount: postsResult.data?.metaobjects?.edges?.length || 0,
      listsCount: listsResult.data?.metaobjects?.edges?.length || 0
    });

  } catch (error) {
    console.error("Debug query error:", error);
    return json({ 
      error: error instanceof Error ? error.message : "Unknown error",
      posts: [],
      lists: [],
      postsCount: 0,
      listsCount: 0
    });
  }
};
