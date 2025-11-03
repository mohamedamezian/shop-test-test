import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";


// Om carousel images op te vangen
export interface InstagramCarouselData {
    media_url:string
    media_type: string
    id: string
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
            provider: "instagram"
        }
        }
    });

    if(!account){
        return { error: 'No Instagram account connected' };
    }

    // Check existing files to avoid duplicates
    const existingFileQuery = await admin.graphql(
        `#graphql
        query {
            files(first:50, query: "instagram_post_") {
                edges {
                    node {
                        ... on MediaImage {
                            alt
                            image {
                                url
                            }          
                        }
                    }
                }
            }
        }
        `
    )

    const existingFilesJson = await existingFileQuery.json();

    const existingKeys = new Set(
        existingFilesJson.data.files.edges.map((e:any) =>
        e.node.alt.replace('instagram_post_','')
    )
);

    // Fetch posts from Instagram Graph API
    const igResponse = await fetch(`https://graph.instagram.com/me/media?fields=id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,username,children{media_url,media_type}&access_token=${account.accessToken}`);
    const igData = await igResponse.json();
    const posts = igData.data as InstagramPost[];
    const uploadResults = [];

    for (const post of posts) {
        const uniqueKey = post.id;
        if (existingKeys.has(uniqueKey)) {
            // Skip already uploaded posts
            console.log(`⏭️  Skipping already uploaded post: ${post.id}`);
            continue;
        }
        // define fileId for instagram_post image field
        let fileId: string
        
        // Normal post upload
        if(post.media_type !== "CAROUSEL_ALBUM"){
            const postResponse = await admin.graphql(
                `#graphql
                mutation fileCreate($files: [FileCreateInput!]!) {
                    fileCreate(files: $files) {
                        files {
                            id
                            fileStatus
                            alt
                            createdAt
                            ... on MediaImage {
                                image {
                                    width
                                    height
                                    url
                                }
                            }
                        }
                        userErrors {
                            field
                            message
                        }
                    }
                }`,{
                    variables:{
                        files: [
                            {
                            alt: `instagram_post_${uniqueKey}`,
                            contentType: "IMAGE",
                            originalSource: post.media_url,
                            filename: `instagram_post_${uniqueKey}.jpg`
                        }
                        ]
                    },
                }
               );
               // take the file ID on creation from response
               const postJson = await postResponse.json();
               fileId = postJson.data?.fileCreate?.files?.[0]?.id;
               uploadResults.push(postJson);
        }

        else{
            // For carousels, upload all children and use the first image as the main image
            const carouselFileIds = [];
            for(const child of post.children?.data || []){
                const carouselResponse = await admin.graphql(
                    `#graphql
                    mutation fileCreate($files: [FileCreateInput!]!) {
                        fileCreate(files: $files) {
                            files {
                                id
                                fileStatus
                                alt
                                createdAt
                                ... on MediaImage {
                                    image {
                                        width
                                        height
                                        url
                                    }
                                }
                            }
                            userErrors {
                                field
                                message
                            }
                        }
                    }`,{
                        variables:{
                            files: [
                                {
                                alt: `instagram_post_${uniqueKey}`,
                                contentType: "IMAGE",
                                originalSource: child.media_url,
                                filename: `instagram_post_${uniqueKey}.jpg`
                            }
                            ]
                        },
                    }
                   );
                    
                   const carouselJson = await carouselResponse.json();
                   const childFileId = carouselJson.data?.fileCreate?.files?.[0]?.id;
                   if (childFileId) {
                       carouselFileIds.push(childFileId);
                   }
                   uploadResults.push(carouselJson);
            }
            // Use the first carousel image as the main image
            fileId = carouselFileIds[0] || null;
        }
        
        // Only create metaobject if we have a file ID
        if (fileId) {
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
                        metaobject:{
                            type: "$app:instagram_post",
                            fields: [
                                {key:"data", value: JSON.stringify(post)},
                                {key: "image", value: fileId}
                            ]
                        }
                    }
                }
            );
            
            const metaobjectJson = await metaobjectResponse.json();
            const metaobjectId = metaobjectJson.data?.metaobjectCreate?.metaobject?.id;
            
            // Set metaobject status to active
            if (metaobjectId) {
                await admin.graphql(
                    `#graphql
                    mutation metaobjectUpdate($id: ID!, $metaobject: MetaobjectUpdateInput!) {
                        metaobjectUpdate(id: $id, metaobject: $metaobject) {
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
                            id: metaobjectId,
                            metaobject: {
                                capabilities: {
                                    publishable: {
                                        status: "ACTIVE"
                                    }
                                }
                            }
                        }
                    }
                );
                console.log(`✅ Created and activated metaobject for post ${post.id}: ${metaobjectId}`);
            }
        }

    }
    return { posts, uploadResults  };
}
