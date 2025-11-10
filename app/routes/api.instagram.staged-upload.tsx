import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// Types for Instagram data
export interface InstagramCarouselData {
  media_url: string;
  media_type: string;
  id: string;
  thumbnail_url?: string;
}

export interface InstagramPost {
  id: string;
  media_type: string;
  media_url: string;
  thumbnail_url?: string;
  permalink: string;
  caption?: string;
  timestamp: string;
  username: string;
  children?: {
    data: InstagramCarouselData[];
  };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  // ========================================
  // HELPER FUNCTION 1: Create Shopify file from URL (for images)
  // ========================================
  async function createShopifyFile(
    mediaUrl: string,
    alt: string,
    contentType: "IMAGE" | "VIDEO",
  ) {
    const mutation = `#graphql
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            id
            fileStatus
            alt
            createdAt
            ... on MediaImage {
              image {
                url
              }
            }
            ... on Video {
              originalSource {
                url
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await admin.graphql(mutation, {
      variables: {
        files: [
          {
            alt: alt,
            contentType: contentType,
            originalSource: mediaUrl,
          },
        ],
      },
    });

    const data = await response.json();
    return data;
  }

  // ========================================
  // HELPER FUNCTION 2: Upload video using staged upload
  // ========================================
  async function uploadVideoWithStaging(videoUrl: string, alt: string) {
    try {
      console.log(`Downloading video for staging: ${alt}`);

      // Step 1: Download video from Instagram
      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) {
        throw new Error(
          `Failed to download video: ${videoResponse.statusText}`,
        );
      }

      const videoBlob = await videoResponse.blob();
      const videoArrayBuffer = await videoBlob.arrayBuffer();
      const fileSize = videoArrayBuffer.byteLength;

      console.log(`Video size: ${fileSize} bytes`);

      // Step 2: Create staged upload
      const stagedMutation = `#graphql
        mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
          stagedUploadsCreate(input: $input) {
            stagedTargets {
              url
              resourceUrl
              parameters {
                name
                value
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const stagedResponse = await admin.graphql(stagedMutation, {
        variables: {
          input: [
            {
              resource: "VIDEO",
              filename: `${alt}.mp4`,
              mimeType: "video/mp4",
              fileSize: fileSize.toString(),
              httpMethod: "POST",
            },
          ],
        },
      });

      const stagedData = await stagedResponse.json();
      const stagedTarget =
        stagedData.data?.stagedUploadsCreate?.stagedTargets?.[0];

      if (!stagedTarget) {
        throw new Error("Failed to create staged upload");
      }

      console.log(`Uploading video to staged target`);

      // Step 3: Upload to staged target
      const formData = new FormData();
      stagedTarget.parameters.forEach((param: any) => {
        formData.append(param.name, param.value);
      });
      formData.append("file", videoBlob, `${alt}.mp4`);

      const uploadResponse = await fetch(stagedTarget.url, {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error(
          `Failed to upload to staged target: ${uploadResponse.statusText}`,
        );
      }

      console.log(`Creating Shopify video file`);

      // Step 4: Create the file in Shopify
      const fileData = await createShopifyFile(
        stagedTarget.resourceUrl,
        alt,
        "VIDEO",
      );

      return fileData;
    } catch (error) {
      console.error(`Error uploading video ${alt}:`, error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        data: {
          fileCreate: {
            files: [],
            userErrors: [{ message: errorMessage }],
          },
        },
      };
    }
  }

  // ========================================
  // HELPER FUNCTION 3: Upload any media (image or video)
  // ========================================
  async function uploadMediaFile(
    mediaUrl: string,
    mediaType: string,
    alt: string,
  ) {
    try {
      const isVideo = mediaType === "VIDEO";

      console.log(`Uploading ${mediaType}: ${alt}`);

      if (isVideo) {
        // Videos need staged upload because Instagram URLs are temporary
        return await uploadVideoWithStaging(mediaUrl, alt);
      } else {
        // Images can be uploaded directly
        const fileData = await createShopifyFile(mediaUrl, alt, "IMAGE");
        console.log(`Shopify image file created for ${alt}`);
        return fileData;
      }
    } catch (error) {
      console.error(`Error uploading ${alt}:`, error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        data: {
          fileCreate: {
            files: [],
            userErrors: [{ message: errorMessage }],
          },
        },
      };
    }
  }

  // ========================================
  // HELPER FUNCTION 4: Create Instagram post metaobject
  // ========================================
  async function createPostMetaobject(post: InstagramPost, fileIds: string[]) {
    const mutation = `#graphql
      mutation metaobjectCreate($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject {
            id
            handle
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await admin.graphql(mutation, {
      variables: {
        metaobject: {
          type: "$app:instagram_post",
          fields: [
            { key: "data", value: JSON.stringify(post) },
            { key: "images", value: JSON.stringify(fileIds) },
            { key: "caption", value: post.caption || "No caption" },
          ],
        },
      },
    });

    const data = await response.json();
    return data;
  }

  // ========================================
  // HELPER FUNCTION 5: Get existing Instagram posts
  // ========================================
  async function getExistingPosts() {
    const query = `#graphql
      query {
        files(first: 50, query: "instagram_post_") {
          edges {
            node {
              ... on MediaImage {
                alt
              }
              ... on Video {
                alt
              }
            }
          }
        }
      }
    `;

    const response = await admin.graphql(query);
    const data = await response.json();

    // Get all the alt texts and extract the post IDs
    const existingKeys = new Set(
      data.data.files.edges.map(
        (e: any) => e.node.alt?.replace("instagram_post_", "") || "",
      ),
    );

    return existingKeys;
  }

  // ========================================
  // MAIN LOGIC STARTS HERE
  // ========================================

  // Get Instagram account from database
  const account = await prisma.socialAccount.findUnique({
    where: {
      shop_provider: {
        shop: session.shop,
        provider: "instagram",
      },
    },
  });

  if (!account) {
    return { error: "No Instagram account connected" };
  }

  // Get existing posts to avoid duplicates
  const existingKeys = await getExistingPosts();

  // Fetch posts from Instagram API
  const igResponse = await fetch(
    `https://graph.instagram.com/me/media?fields=id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,username,children{media_url,media_type,thumbnail_url}&access_token=${account.accessToken}`,
  );
  const igData = await igResponse.json();
  const posts = igData.data as InstagramPost[];

  // Track results
  const uploadResults = [];
  const postObjectIds = [];

  // Loop through each Instagram post
  for (const post of posts) {
    console.log(`\n--- Processing post: ${post.id} (${post.media_type}) ---`);

    // Skip if already uploaded
    if (existingKeys.has(post.id)) {
      console.log(`Post ${post.id} already exists, skipping`);
      continue;
    }

    // Array to collect all file IDs for this post
    let fileIds: string[] = [];

    // Handle different post types
    if (post.media_type === "CAROUSEL_ALBUM" && post.children?.data) {
      // This is a carousel with multiple images/videos
      console.log(
        `Processing carousel with ${post.children.data.length} items`,
      );

      for (let i = 0; i < post.children.data.length; i++) {
        const child = post.children.data[i];
        const childAlt = `instagram_post_${post.id}_${child.id}`;

        // Upload the child media
        const result = await uploadMediaFile(
          child.media_url,
          child.media_type,
          childAlt,
        );

        // Get the file IDs
        const childFileIds = (result.data?.fileCreate?.files || []).map(
          (f: any) => f.id,
        );
        fileIds.push(...childFileIds);
        uploadResults.push(result);
      }
    } else {
      // This is a single image or video
      const alt = `instagram_post_${post.id}`;

      // Upload the media
      const result = await uploadMediaFile(
        post.media_url,
        post.media_type,
        alt,
      );

      // Get the file IDs
      const singleFileIds = (result.data?.fileCreate?.files || []).map(
        (f: any) => f.id,
      );
      fileIds.push(...singleFileIds);
      uploadResults.push(result);
    }

    // Create metaobject if we have file IDs
    if (fileIds.length > 0) {
      console.log(`Creating metaobject with ${fileIds.length} file(s)`);
      const metaobjectResult = await createPostMetaobject(post, fileIds);

      // Check for errors
      if (metaobjectResult.data?.metaobjectCreate?.userErrors?.length > 0) {
        console.error(
          `Metaobject errors:`,
          metaobjectResult.data.metaobjectCreate.userErrors,
        );
      } else {
        const metaobjectId =
          metaobjectResult.data?.metaobjectCreate?.metaobject?.id;
        postObjectIds.push(metaobjectId);
        console.log(`Created metaobject: ${metaobjectId}`);
      }
    }
  }

  // Create Instagram list metaobject
  if (postObjectIds.length > 0) {
    const listMutation = `#graphql
      mutation metaobjectCreate($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject {
            id
            handle
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const listResponse = await admin.graphql(listMutation, {
      variables: {
        metaobject: {
          type: "$app:instagram_list",
          fields: [
            { key: "data", value: JSON.stringify(igData) },
            { key: "posts", value: JSON.stringify(postObjectIds) },
          ],
        },
      },
    });

    const listData = await listResponse.json();
    const listId = listData.data?.metaobjectCreate?.metaobject?.id;
    console.log(`Created Instagram list metaobject: ${listId}`);
  }

  return {
    success: true,
    postsProcessed: posts.length,
    postsUploaded: postObjectIds.length,
    uploadResults,
    postObjectIds,
  };
};
