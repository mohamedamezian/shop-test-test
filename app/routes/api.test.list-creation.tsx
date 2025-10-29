import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    // Test creating an Instagram list with existing post IDs
    const testPostIds = [
      "gid://shopify/Metaobject/199903379747",
      "gid://shopify/Metaobject/199903510819"
    ];

    console.log("Testing Instagram list creation with post IDs:", testPostIds);

    const listResponse = await admin.graphql(
      `#graphql
      mutation metaobjectCreate($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject {
            id
            handle
            fields {
              key
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          metaobject: {
            
            type: "$app:instagram_list",
            fields: [
              {
                key: "post_references",
                value: JSON.stringify(testPostIds)
              },
              {
                key: "data",
                value: JSON.stringify({
                  created_at: new Date().toISOString(),
                  batch_id: "test-batch",
                  total_posts: testPostIds.length,
                  instagram_user_id: "test_user",
                  uploaded_posts_count: testPostIds.length
                })
              }
            ],
            handle: `test-instagram-list-${Date.now()}`
          }
        }
      }
    );

    const result = await listResponse.json();
    console.log("Full response:", JSON.stringify(result, null, 2));

    return json({
      success: true,
      result: result,
      testPostIds: testPostIds
    });

  } catch (error) {
    console.error("Test list creation error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};
