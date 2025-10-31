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

    if(!account){
        return { error: 'No Instagram account connected' };
    }
    // Fetch posts from Instagram Graph API
    const posts = await fetch(`https://graph.instagram.com/me/media?fields=id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,username,children{media_url,media_type}&access_token=${account.accessToken}`);
    const postsData = await posts.json();

    // Return json met posts
    return {
        posts: postsData.data as InstagramPost[],
        shop: session.shop
    }
};
