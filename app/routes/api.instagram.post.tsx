import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// Om carousel images op te vangen
export interface InstagramCarouselData {
  media_url: string;
  media_type: string;
  id: string;
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
  // Get Instagram account
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

  // Check existing Shopify files that contain instagram_post_ in alt text
  const existingFileQuery = await admin.graphql(
    `#graphql
        query {
            files(first:50, query: "instagram_post_") {
                edges {
                    node {
                        ... on MediaImage {
                            alt
                            # image {
                            #     url
                            # }          
                        }
                    }
                }
            }
        }
        `,
  );

  const existingFilesJson = await existingFileQuery.json();

  // Maps through the edges that are queried, parses the alt text to only get id and them to a Set to avoid duplicates
  const existingKeys = new Set(
    existingFilesJson.data.files.edges.map((e: any) =>
      e.node.alt.replace("instagram_post_", ""),
    ),
  );

  // Mutation to create files
  const fileCreation = `#graphql
        mutation fileCreate($files: [FileCreateInput!]!) {
            fileCreate(files: $files) {
                files {
                    id
                    fileStatus
                    alt
                    createdAt
                    ... on MediaImage {
                        image{
                            width
                            height
                            url
                        }
                    } 
            } userErrors {
                field
                message
            }
        }
        }`;

  const metaobjectUpsert = `#graphql
    mutation metaobjectUpsert($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
        metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
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

  const metaobjectChecker = await admin.graphql(
    `#graphql
        query getInstagramPosts {
            metaobjects(type: "$app:instagram_post", first: 100) {
              edges {
                node {
                    handle
                    id
                    fields {
                      key
                      value
                    }
                  }
              }
            }
          }`,
  );
  const existingMetaobjectsJson = await metaobjectChecker.json();

  // Fetch posts from Instagram Graph API
  const igResponse = await fetch(
    `https://graph.instagram.com/me/media?fields=id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,username,children{media_url,media_type}&access_token=${account.accessToken}`,
  );
  const igData = await igResponse.json();
  const posts = igData.data as InstagramPost[];
  const uploadResults = []; // For debugging purposes
  const postObjectIds = [];
  // Loop through posts
  for (const post of posts) {
    console.log(`Processing post: ${post.id}, type: ${post.media_type}`);
    const uniqueKey = post.id;
    if (existingKeys.has(uniqueKey)) {
      // Skip already uploaded posts
      console.log(`Post already exists: ${post.id}`);
      continue;
    }
    // Define fileId for instagram_post image field
    let fileId: string;

    // Normal post upload
    if (post.media_type !== "CAROUSEL_ALBUM") {
      const postResponse = await admin.graphql(fileCreation, {
        variables: {
          files: [
            {
              alt: `instagram_post_${uniqueKey}`,
              contentType: "IMAGE",
              originalSource: post.media_url,
              filename: `instagram_post_${uniqueKey}.jpg`,
            },
          ],
        },
      });
      // take the file ID on creation from response
      const postJson = await postResponse.json();
      fileId = postJson.data?.fileCreate?.files?.[0]?.id;
      uploadResults.push(postJson);

      // Only create metaobject if we have a file ID
      if (fileId) {
        const metaobjectResponse = await admin.graphql(metaobjectUpsert, {
          variables: {
            handle: {
              type: "$app:instagram_post",
              handle: post.id,
            },
            metaobject: {
              fields: [
                { key: "data", value: JSON.stringify(post) },
                { key: "image", value: fileId },
              ],
            },
          },
        });

        const metaobjectJson = await metaobjectResponse.json();
        console.log(
          `Metaobject upsert response for post ${post.id}:`,
          JSON.stringify(metaobjectJson, null, 2),
        );
        const metaobjectId =
          metaobjectJson.data?.metaobjectUpsert?.metaobject?.id;
        postObjectIds.push(metaobjectId);
        console.log(
          `Created and activated metaobject for post ${post.id}: ${metaobjectId}`,
        );
      }
    } else {
      // For carousels, create a separate metaobject for each child img
      console.log(
        `Processing carousel with ${post.children?.data?.length || 0} children`,
      );
      for (const child of post.children?.data || []) {
        const childUniqueKey = `${uniqueKey}_${child.id}`;
        console.log(`Processing carousel child: ${childUniqueKey}`);

        // Check if this specific carousel child already exists
        if (existingKeys.has(childUniqueKey)) {
          console.log(`Carousel child already exists: ${childUniqueKey}`);
          continue;
        }

        const carouselResponse = await admin.graphql(fileCreation, {
          variables: {
            files: [
              {
                alt: `instagram_post_${childUniqueKey}`,
                contentType: "IMAGE",
                originalSource: child.media_url,
                filename: `instagram_post_${childUniqueKey}.jpg`,
              },
            ],
          },
        });

        const carouselJson = await carouselResponse.json();
        const childFileId = carouselJson.data?.fileCreate?.files?.[0]?.id;
        uploadResults.push(carouselJson);

        // Create metaobject for this carousel image
        if (childFileId) {
          const metaobjectResponse = await admin.graphql(metaobjectUpsert, {
            variables: {
              handle: {
                type: "$app:instagram_post",
                handle: `${uniqueKey}_${child.id}`,
              },
              metaobject: {
                fields: [
                  { key: "data", value: JSON.stringify(post) },
                  { key: "image", value: childFileId },
                ],
              },
            },
          });

          const metaobjectJson = await metaobjectResponse.json();
          console.log(
            `Metaobject upsert response for carousel child ${childUniqueKey}:`,
            JSON.stringify(metaobjectJson, null, 2),
          );
          const metaobjectId =
            metaobjectJson.data?.metaobjectUpsert?.metaobject?.id;
          postObjectIds.push(metaobjectId);
          console.log(
            `Created and activated metaobject for carousel image ${post.id}: ${metaobjectId}`,
          );
        }
      }
    }
  }

  if (existingMetaobjectsJson != null) {
    const metaobjectResponse = await admin.graphql(metaobjectUpsert, {
      variables: {
        handle: {
          type: "$app:instagram_list",
          handle: account.userId,
        },
        metaobject: {
          fields: [
            { key: "data", value: JSON.stringify(igData) },
            { key: "posts", value: JSON.stringify(postObjectIds) },
          ],
        },
      },
    });
    const metaobjectJson = await metaobjectResponse.json();
    const listObjectId = metaobjectJson.data?.metaobjectUpsert?.metaobject?.id;
    console.log(`Created Instagram list metaobject: ${listObjectId}`);
  }

  return { posts, uploadResults, existingMetaobjectsJson, postObjectIds };
};
