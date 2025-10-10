import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  try {
    // Create the Instagram post metaobject definition
    const response = await admin.graphql(
      `#graphql
      mutation metaobjectDefinitionCreate($definition: MetaobjectDefinitionCreateInput!) {
        metaobjectDefinitionCreate(definition: $definition) {
          metaobjectDefinition {
            id
            type
            name
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          definition: {
            type: "instagram_post",
            name: "Instagram Post", 
            description: "Instagram posts synced from Instagram API",
            fieldDefinitions: [
              {
                key: "instagram_id",
                name: "Instagram ID",
                description: "The Instagram post ID",
                type: "single_line_text_field",
                required: true
              },
              {
                key: "caption", 
                name: "Caption",
                description: "The Instagram post caption",
                type: "multi_line_text_field",
                required: false
              },
              {
                key: "image_url",
                name: "Image URL", 
                description: "Shopify file URL for the image",
                type: "url",
                required: true
              },
              {
                key: "permalink",
                name: "Instagram Link",
                description: "Link to the Instagram post", 
                type: "url",
                required: false
              },
              {
                key: "timestamp",
                name: "Posted Date",
                description: "When the post was created on Instagram",
                type: "date_time", 
                required: false
              }
            ]
          }
        }
      }
    );

    const result = await response.json();
    
    if (result.data.metaobjectDefinitionCreate.userErrors.length > 0) {
      return json({ 
        success: false, 
        errors: result.data.metaobjectDefinitionCreate.userErrors 
      });
    }

    return json({ 
      success: true, 
      metaobjectDefinition: result.data.metaobjectDefinitionCreate.metaobjectDefinition
    });

  } catch (error) {
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    });
  }
};
