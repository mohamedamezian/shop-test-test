/**
 * Server-side utilities for Shopify metaobject and file operations
 */

import type { ActionResponse } from "../types/instagram.types";

/**
 * Delete all Instagram metaobjects (posts and list)
 */
async function deleteMetaobjects(admin: any): Promise<{
  postIds: string[];
  listIds: string[];
}> {
  // Query instagram_post metaobjects
  const postMetaobjectsQuery = await admin.graphql(`
    #graphql
    query {
      metaobjects(type: "instagram-post", first: 250) {
        edges { node { id } }
      }
    }
  `);
  const postMetaobjectsJson = await postMetaobjectsQuery.json();
  const postMetaobjectIds =
    postMetaobjectsJson.data?.metaobjects?.edges?.map(
      (e: any) => e.node.id,
    ) || [];

  // Query instagram_list metaobjects
  const listMetaobjectsQuery = await admin.graphql(`
    #graphql
    query {
      metaobjects(type: "instagram-list", first: 10) {
        edges { node { id } }
      }
    }
  `);
  const listMetaobjectsJson = await listMetaobjectsQuery.json();
  const listMetaobjectIds =
    listMetaobjectsJson.data?.metaobjects?.edges?.map(
      (e: any) => e.node.id,
    ) || [];

  // Delete all metaobjects
  for (const id of [...postMetaobjectIds, ...listMetaobjectIds]) {
    await admin.graphql(
      `
      #graphql
      mutation metaobjectDelete($id: ID!) {
        metaobjectDelete(id: $id) {
          deletedId
          userErrors { field message }
        }
      }
    `,
      { variables: { id } },
    );
  }

  return {
    postIds: postMetaobjectIds,
    listIds: listMetaobjectIds,
  };
}

/**
 * Delete Instagram files from Shopify
 */
async function deleteInstagramFiles(admin: any): Promise<string[]> {
  // Query files with instagram-post_ prefix in alt text
  const filesQuery = await admin.graphql(`
    #graphql
    query {
      files(first: 250, query: "alt:instagram-post_") {
        edges { 
          node { 
            id 
            alt
          } 
        }
      }
    }
  `);
  const filesJson = await filesQuery.json();

  // Filter to ONLY files with alt text starting with "instagram-post_"
  const instagramFiles =
    filesJson.data?.files?.edges?.filter((edge: any) =>
      edge.node.alt?.startsWith("instagram-post_"),
    ) || [];

  const fileIds = instagramFiles.map((edge: any) => edge.node.id);

  if (fileIds.length > 0) {
    await admin.graphql(
      `
      #graphql
      mutation fileDelete($fileIds: [ID!]!) {
        fileDelete(fileIds: $fileIds) {
          deletedFileIds
          userErrors { field message }
        }
      }
    `,
      { variables: { fileIds } },
    );
  }

  return fileIds;
}

/**
 * Delete all Instagram data (metaobjects and files)
 */
export async function deleteInstagramData(admin: any): Promise<ActionResponse> {
  try {
    const { postIds, listIds } = await deleteMetaobjects(admin);
    const fileIds = await deleteInstagramFiles(admin);

    const totalMetaobjects = postIds.length + listIds.length;

    console.log(
      `✓ Deleted ${totalMetaobjects} metaobjects and ${fileIds.length} files`,
    );

    return {
      success: true,
      deletedMetaobjects: totalMetaobjects,
      deletedFiles: fileIds.length,
      message: `Deleted ${totalMetaobjects} metaobjects and ${fileIds.length} files`,
    };
  } catch (error) {
    console.error("Delete error:", error);
    return {
      success: false,
      message: "Delete failed. Please try again.",
      status: 500,
    };
  }
}

/**
 * Generate theme editor URL for adding app block with deep linking
 * Uses Shopify's deep linking for simplified app block installation
 * @see https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration#app-blocks
 */
export function generateAppEmbedUrl(shop: string, template: string = "index"): string {
  const storeHandle = shop.replace(".myshopify.com", "");
  const apiKey = process.env.SHOPIFY_API_KEY!;
  const blockHandle = "instagram-carousel";

  // Deep link to theme editor with app block pre-selected
  // Format: addAppBlockId={client-id}/{block-handle}
  return `https://admin.shopify.com/store/${storeHandle}/themes/current/editor?template=${template}&addAppBlockId=${apiKey}/${blockHandle}`;
}

/**
 * Generate theme editor URL for adding app block (legacy method)
 * @deprecated Use generateAppEmbedUrl for app embeds instead
 */
export function generateThemeEditorUrl(
  shop: string,
  template: string,
): string {
  const storeHandle = "near-native-apps-2.myshopify.com";
  // App block ID format: {client-id}/{block-filename}
  const appBlockId = "02fee5ebd0c35e7e65f2bdb8944e1ffa/instagram-carousel";

  return `https://admin.shopify.com/store/${storeHandle}/themes/current/editor?template=${template}&addAppBlockId=${appBlockId}`;
}
