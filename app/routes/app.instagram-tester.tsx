import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Layout, Button, Image, Card, Text, BlockStack, InlineGrid, Spinner } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import type { InstagramPost } from "./api.instagram.post";
import { useState } from "react";
import { PostDisplay } from "./components/PostDisplay";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const { session } = await authenticate.admin(request);
    const account = await prisma.socialAccount.findFirst({
        where: { 
            provider: 'instagram',
            shop: session.shop
        }
    });

    return {
        account,
        shop: session.shop
    };
};


export default function InstagramTester() {
    const data = useLoaderData<typeof loader>();
    const [postsData, setPostsData] = useState<InstagramPost[] | null>(null);
    const [loading, setLoading] = useState(false);

    //
    const pullPosts = async () => {
        // Function to pull Instagram posts
        setLoading(true);
  try {
      const response = await fetch('/api/instagram/post')
      const postsData = await response.json()
      setPostsData(postsData.posts)
    } catch (error) {
      console.error('Failed to fetch posts:', error)
    } finally {
      setLoading(false)
    }
    };

    return (
        <Page title="Instagram Post Puller">
      <Layout>
        <Layout.Section>
          <Button onClick={pullPosts} loading={loading}>
            Fetch Instagram Posts
          </Button>
        </Layout.Section>
        {
            loading && (
              <Layout.Section>
                <Spinner accessibilityLabel="Loading posts" size="large" />
              </Layout.Section>
            )
        }

        {postsData && (
          <Layout.Section>
            {postsData.map((post) => (
              <PostDisplay key={post.id} post={post} />
            ))}
          </Layout.Section>
        )}
      </Layout>
    </Page>
    );
}
