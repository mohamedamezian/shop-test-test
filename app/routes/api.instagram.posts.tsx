import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  // Get Instagram account
  const account = await prisma.socialAccount.findUnique({
    where: {
      shop_provider: {
        shop: session.shop,
        provider: "instagram"
      }
    }
  });

  if (!account?.accessToken) {
    return { error: "No Instagram connected", posts: [] };
  }

  //Fetch Instagram posts
  const response = await fetch(`https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,permalink,timestamp&access_token=${account.accessToken}`);
  const data = await response.json();

  return { posts: data.data || [] };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  // Authenticate admin and get session
  const { session, admin } = await authenticate.admin(request);
  
  if (!session?.accessToken) {
    return json({ error: "No access token available" }, { status: 401 });
  }

  const { postIds } = await request.json(); // Array of Instagram post IDs to upload
  
  if (!postIds || !Array.isArray(postIds)) {
    return json({ error: "Please provide an array of post IDs" }, { status: 400 });
  }

  // Get Instagram account
  const account = await prisma.socialAccount.findUnique({
    where: {
      shop_provider: {
        shop: session.shop,
        provider: "instagram"
      }
    }
  });

  if (!account?.accessToken) {
    return json({ error: "No Instagram connected" }, { status: 400 });
  }

  const uploadedFiles = [];
  const errors = [];

  for (const postId of postIds) {
    try {
      // 1️⃣ Get Instagram post details
      const postResponse = await fetch(`https://graph.instagram.com/${postId}?fields=id,caption,media_type,media_url,permalink,timestamp,username&access_token=${account.accessToken}`);
      const post = await postResponse.json();

      if (!post.media_url) {
        errors.push(`Post ${postId}: No media URL found`);
        continue;
      }

      // 2️⃣ Create staged upload in Shopify
      const stagedUploadResponse = await admin.graphql(
        `#graphql
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
        }`,
        {
          variables: {
            input: [
              {
                resource: "IMAGE",
                filename: `instagram-${postId}.jpg`,
                mimeType: "image/jpeg",
                httpMethod: "POST"
              }
            ]
          }
        }
      );
    
      const stagedResult = await stagedUploadResponse.json();

      if (stagedResult.data.stagedUploadsCreate.userErrors.length > 0) {
        errors.push(`Post ${postId}: ${stagedResult.data.stagedUploadsCreate.userErrors[0].message}`);
        continue;
      }
      const target = stagedResult.data.stagedUploadsCreate.stagedTargets[0];

      // 3️⃣ Download the Instagram image
      const imageBuffer = await fetch(post.media_url).then((r) => r.arrayBuffer());
      
      // 4️⃣ Upload to Shopify
      const form = new FormData();
      for (const param of target.parameters) {
        form.append(param.name, param.value);
      }
      
      const imageBlob = new Blob([imageBuffer], { type: 'image/jpeg' });
      form.append("file", imageBlob, `instagram-${postId}.jpg`);

      const uploadResponse = await fetch(target.url, {
        method: "POST",
        body: form
      });

      if (uploadResponse.ok) {
        // 5️⃣ Create file record in Shopify to get proper file ID
        let fileId = null;
        try {
          const fileCreateResponse = await admin.graphql(
            `#graphql
            mutation fileCreate($files: [FileCreateInput!]!) {
              fileCreate(files: $files) {
                files {
                  id
                  fileStatus
                  ... on MediaImage {
                    id
                    image {
                      url
                    }
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
                files: [
                  {
                    originalSource: target.resourceUrl,
                    contentType: "IMAGE"
                  }
                ]
              }
            }
          );

          const fileResult = await fileCreateResponse.json();
          
          if (fileResult.data.fileCreate.userErrors.length === 0 && fileResult.data.fileCreate.files.length > 0) {
            fileId = fileResult.data.fileCreate.files[0].id;
            console.log(`✅ Created file record for post ${postId}: ${fileId}`);
          } else {
            console.warn(`File creation errors for post ${postId}:`, fileResult.data.fileCreate.userErrors);
          }
        } catch (fileError) {
          console.error(`File creation failed for post ${postId}:`, fileError);
        }

        // 6️⃣ Create metaobject in Shopify to store post details
        let metaobjectId = null;
        try {
          const metaobjectResponse = await admin.graphql(
            `#graphql
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
            }`,
            {
              variables: {
                metaobject: {
                  type: "$app:instagram_post",
                  
                  fields: [
                    ...(fileId ? [{ 
                      key: "list_reference", 
                      value: fileId 
                    }] : []),
                    { 
                      key: "post", 
                      value: JSON.stringify({
                        instagram_id: postId,
                        caption: post.caption || "",
                        permalink: post.permalink,
                        timestamp: post.timestamp,
                        media_type: post.media_type,
                        media_url: post.media_url,
                        shopify_file_url: target.resourceUrl,
                        shopify_file_id: fileId
                      })
                    }
                  ]
                }
              }
            }
          );

          const metaResult = await metaobjectResponse.json();
          
          if (metaResult.data.metaobjectCreate.userErrors.length > 0) {
            console.warn(`Metaobject creation error for post ${postId}:`, metaResult.data.metaobjectCreate.userErrors);
            errors.push(`Post ${postId}: Metaobject creation failed - ${metaResult.data.metaobjectCreate.userErrors[0].message}`);
          } else {
            metaobjectId = metaResult.data.metaobjectCreate.metaobject.id;
            console.log(`✅ Created metaobject for post ${postId}: ${metaobjectId}`);
          }
        } catch (metaError) {
          console.error(`Metaobject creation failed for post ${postId}:`, metaError);
          errors.push(`Post ${postId}: Metaobject creation failed`);
        }

        uploadedFiles.push({
          postId: postId,
          shopifyUrl: target.resourceUrl,
          caption: post.caption,
          permalink: post.permalink,
          timestamp: post.timestamp,
          username: post.username,
          metaobjectId: metaobjectId // Add the metaobject ID
        });
      } else {
        errors.push(`Post ${postId}: Upload failed`);
      }

    } catch (error) {
      errors.push(`Post ${postId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 7️⃣ Auto-create Instagram list with uploaded posts and cross-reference
  let createdList = null;
  if (uploadedFiles.length > 0) {
    const postMetaobjectIds = uploadedFiles
      .filter(file => file.metaobjectId)
      .map(file => file.metaobjectId);
    
    if (postMetaobjectIds.length > 0) {
      try {
        // Create the Instagram list that references all posts
        const timestamp = new Date().toISOString().split('T')[0];
        const listResponse = await admin.graphql(
          `#graphql
          mutation metaobjectCreate($metaobject: MetaobjectCreateInput!) {
            metaobjectCreate(metaobject: $metaobject) {
              metaobject {
                id
                handle
                capabilities{
                  publishable{
                    status
                  }
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
                    value: JSON.stringify(postMetaobjectIds)
                  },
                  {
                    key: "data",
                    value: JSON.stringify({
                      created_at: new Date().toISOString(),
                      batch_id: `instagram-batch-${timestamp}`,
                      total_posts: postMetaobjectIds.length,
                      instagram_user_id: uploadedFiles[0]?.username || 'unknown',
                      uploaded_posts_count: uploadedFiles.length
                    })
                  }
                ],
                handle: `instagram-batch-${timestamp}-${Date.now()}`
              }
            }
          }
        );

        const listResult = await listResponse.json();
        console.log("Full list creation response:", JSON.stringify(listResult, null, 2));

        if (listResult.data?.metaobjectCreate?.metaobject) {
          createdList = listResult.data.metaobjectCreate.metaobject;
          console.log(`✅ Auto-created Instagram list: ${createdList.id} with ${postMetaobjectIds.length} posts`);

          // Immediately update status to active
          try {
            const updateResponse = await admin.graphql(
              `#graphql
              mutation metaobjectUpdate($id: ID!, $metaobject: MetaobjectUpdateInput!) {
                metaobjectUpdate(id: $id, metaobject: $metaobject) {
                  metaobject {
                    id
                    handle
                    capabilities{
                      publishable{
                        status
                      }
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
                  id: createdList.id,
                  metaobject: {
                    capabilities: {
                      publishable: {
                        status: "active"
                      }
                    }
                  }
                }
              }
            );
            const updateResult = await updateResponse.json();
            if (updateResult.data?.metaobjectUpdate?.metaobject?.status === "active") {
              createdList.status = "active";
              console.log(`✅ Set Instagram list status to active: ${createdList.id}`);
            } else if (updateResult.data?.metaobjectUpdate?.userErrors?.length > 0) {
              console.error("Status update failed with userErrors:", updateResult.data.metaobjectUpdate.userErrors);
              errors.push(`Status update failed: ${JSON.stringify(updateResult.data.metaobjectUpdate.userErrors)}`);
            }
          } catch (updateError) {
            console.warn("Failed to update Instagram list status:", updateError);
          }

        } else if (listResult.data?.metaobjectCreate?.userErrors?.length > 0) {
          console.error("List creation failed with userErrors:", listResult.data.metaobjectCreate.userErrors);
          errors.push(`List creation failed: ${JSON.stringify(listResult.data.metaobjectCreate.userErrors)}`);
        } else {
          console.error("List creation failed - no metaobject returned:", listResult);
          errors.push(`List creation failed: No metaobject returned - ${JSON.stringify(listResult)}`);
        }
      } catch (listError) {
        console.warn("Failed to auto-create Instagram list:", listError);
      }
    }
  }

  return json({
    success: uploadedFiles.length > 0,
    uploadedFiles,
    errors,
    summary: `Uploaded ${uploadedFiles.length} of ${postIds.length} posts`,
    createdList: createdList,
    postMetaobjectIds: uploadedFiles.filter(f => f.metaobjectId).map(f => f.metaobjectId)
  });
};