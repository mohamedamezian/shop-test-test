/**
 * Server-side utilities for Instagram account operations
 */

import type { InstagramAccount, SyncStats } from "../types/instagram.types";

/**
 * Fetch Instagram profile information from Graph API
 */
export async function getInstagramProfile(
  accessToken: string,
): Promise<InstagramAccount | null> {
  try {
    const profileResponse = await fetch(
      `https://graph.instagram.com/me?fields=id,username,profile_picture_url,media_count&access_token=${accessToken}`,
    );
    const profileData = await profileResponse.json();

    return {
      username: profileData.username || "Unknown",
      userId: profileData.id,
      profilePicture: profileData.profile_picture_url,
      connectedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error fetching Instagram profile:", error);
    return null;
  }
}

/**
 * Get sync statistics from Shopify metaobjects and files
 */
export async function getSyncStats(admin: any): Promise<SyncStats> {
  try {
    // Count instagram-post metaobjects
    const postsCountQuery = await admin.graphql(`#graphql
      query {
        metaobjects(type: "instagram-post", first: 250) {
          nodes {
            id
          }
        }
      }
    `);
    const postsCountData = await postsCountQuery.json();

    // Get instagram-list metaobject and last sync time
    const listQuery = await admin.graphql(`#graphql
      query {
        metaobjects(type: "instagram-list", first: 1) {
          nodes {
            id
            fields {
              key
              value
            }
            updatedAt
          }
        }
      }
    `);
    const listData = await listQuery.json();

    // Count files with instagram-post prefix in alt text
    const filesCountQuery = await admin.graphql(`#graphql
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
    const filesCountData = await filesCountQuery.json();

    // Filter files to only those starting with "instagram"
    const instagramFiles =
      filesCountData.data?.files?.edges?.filter((edge: any) =>
        edge.node.alt?.startsWith("instagram"),
      ) || [];

    // Calculate metaobjects count: posts + list (if exists)
    const postsCount = postsCountData.data?.metaobjects?.nodes?.length || 0;
    const hasListMetaobject =
      (listData.data?.metaobjects?.nodes?.length || 0) > 0;

    return {
      lastSyncTime: listData.data?.metaobjects?.nodes?.[0]?.updatedAt || null,
      postsCount,
      filesCount: instagramFiles.length,
      metaobjectsCount: postsCount + (hasListMetaobject ? 1 : 0),
    };
  } catch (error) {
    console.error("Error fetching sync stats:", error);
    return {
      lastSyncTime: null,
      postsCount: 0,
      filesCount: 0,
      metaobjectsCount: 0,
    };
  }
}

/**
 * Get available theme pages/templates
 */
export async function getThemePages(
  admin: any,
): Promise<Array<{ label: string; value: string }>> {
  try {
    // Get the published theme
    const themesQuery = await admin.graphql(`
      #graphql
      query {
        themes(first: 1, roles: MAIN) {
          nodes {
            id
            name
            role
          }
        }
      }
    `);
    const themesData = await themesQuery.json();
    const publishedTheme = themesData.data?.themes?.nodes?.[0];

    if (publishedTheme) {
      // Common Shopify theme templates
      return [
        { label: "Home Page", value: "index" },
        { label: "Product Page", value: "product" },
        { label: "Collection Page", value: "collection" },
        { label: "Page", value: "page" },
        { label: "Blog", value: "blog" },
        { label: "Article", value: "article" },
        { label: "Cart", value: "cart" },
        { label: "Search", value: "search" },
      ];
    }
  } catch (error) {
    console.error("Error fetching theme pages:", error);
  }

  return [];
}
