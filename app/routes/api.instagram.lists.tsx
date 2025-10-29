import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

// GET: Retrieve Instagram lists
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  try {
    const response = await admin.graphql(
      `#graphql
      query getInstagramLists {
        metaobjects(type: "$app:instagram_list", first: 20) {
          edges {
            node {
              id
              handle
              fields {
                key
                value
                reference {
                  ... on Metaobject {
                    id
                    handle
                    fields {
                      key
                      value
                    }
                  }
                }
                references(first: 10) {
                  edges {
                    node {
                      ... on Metaobject {
                        id
                        handle
                        fields {
                          key
                          value
                        }
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

    const result = await response.json();
    return json({ lists: result.data.metaobjects.edges });
  } catch (error) {
    return json({ error: "Failed to fetch Instagram lists", lists: [] });
  }
};

// POST: Create or update Instagram list
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  
  const { action: actionType, listName, postMetaobjectIds, listId } = await request.json();

  try {
    if (actionType === "create") {
      // Create new Instagram list
      const createResponse = await admin.graphql(
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
                  key: "post_reference",
                  value: postMetaobjectIds // Array of Instagram post metaobject IDs
                }
              ],
              ...(listName ? { handle: listName.toLowerCase().replace(/\s+/g, '-') } : {})
            }
          }
        }
      );

      const createResult = await createResponse.json();
      
      if (createResult.data.metaobjectCreate.userErrors.length > 0) {
        return json({ 
          success: false, 
          errors: createResult.data.metaobjectCreate.userErrors 
        });
      }

      return json({ 
        success: true, 
        list: createResult.data.metaobjectCreate.metaobject,
        message: `Created Instagram list with ${postMetaobjectIds.length} posts`
      });

    } else if (actionType === "update" && listId) {
      // Update existing Instagram list
      const updateResponse = await admin.graphql(
        `#graphql
        mutation metaobjectUpdate($id: ID!, $metaobject: MetaobjectUpdateInput!) {
          metaobjectUpdate(id: $id, metaobject: $metaobject) {
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
            id: listId,
            metaobject: {
              
              fields: [
                {
                  key: "post_reference",
                  value: postMetaobjectIds
                }
              ]
            }
          }
        }
      );

      const updateResult = await updateResponse.json();
      
      if (updateResult.data.metaobjectUpdate.userErrors.length > 0) {
        return json({ 
          success: false, 
          errors: updateResult.data.metaobjectUpdate.userErrors 
        });
      }

      return json({ 
        success: true, 
        list: updateResult.data.metaobjectUpdate.metaobject,
        message: `Updated Instagram list with ${postMetaobjectIds.length} posts`
      });

    } else if (actionType === "auto-create-from-upload") {
      // Automatically create a list from recently uploaded posts
      const today = new Date().toISOString().split('T')[0];
      const listName = `Instagram Upload ${today}`;
      
      const createResponse = await admin.graphql(
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
                  key: "post_reference",
                  value: postMetaobjectIds
                }
              ],
              handle: `instagram-upload-${today}`
            }
          }
        }
      );

      const createResult = await createResponse.json();
      
      if (createResult.data.metaobjectCreate.userErrors.length > 0) {
        return json({ 
          success: false, 
          errors: createResult.data.metaobjectCreate.userErrors 
        });
      }

      return json({ 
        success: true, 
        list: createResult.data.metaobjectCreate.metaobject,
        message: `Auto-created list "${listName}" with ${postMetaobjectIds.length} posts`
      });
    }

    return json({ success: false, error: "Invalid action type" });

  } catch (error) {
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    });
  }
};
