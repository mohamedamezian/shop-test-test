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
               const json = await postResponse.json();
               uploadResults.push(json.data);
        }

        else{
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
                   const json = await carouselResponse.json();
                   uploadResults.push(json.data);
            }
        }
    }
    return { posts, uploadResults };
}
