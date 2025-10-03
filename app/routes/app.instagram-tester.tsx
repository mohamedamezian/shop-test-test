import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Card, Page, Layout, Text, List, Banner, Button } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const { session } = await authenticate.admin(request);
    const account = await prisma.socialAccount.findFirst({
        where: { 
            provider: 'instagram',
            shop: session.shop
        }
    })

    const instagramPosts = await fetch(`https://graph.instagram.com/me/media?fields=id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,username&access_token=${account?.accessToken}`);
    const postsData = await instagramPosts.json();
    console.log(postsData);

    return Response.json({
        message: 'ok',
        account,
        shop: session.shop,
        posts: postsData
    })
};


export default function InstagramTester() {
    const data = useLoaderData<typeof loader>();
    console.log(data.posts.data[0].media_url);



  return (
    <Page title="Instagram Graph API Tester">
      <Layout>
    
            <Layout.Section>
              <Card>
                    <Text variant="bodyMd" as="p">User ID: {data.account.userId}</Text>
                    <Text variant="bodyMd" as="p">Access Token: {data.account.accessToken}</Text>
                    <Text variant="bodyMd" as="p">Expires At: {data.account.expiresAt ? new Date(data.account.expiresAt).toLocaleString() : 'No expiration'}</Text>
                    <Text variant="bodyMd" as="p">Created At: {new Date(data.account.createdAt).toLocaleString()}</Text>
                    <Text variant="bodyMd" as="p">Updated At: {new Date(data.account.updatedAt).toLocaleString()}</Text>
                    <Text variant="bodyMd" as="p">Shop: {data.shop}</Text>
              </Card>
            </Layout.Section>
            <Layout.Section>
              <Card>
                {data.posts.data.slice(0,5).map((post: any) => (
                    <div key={post.id} style={{marginBottom: '20px'}}>
                      <img src={post.media_url} alt={post.caption || 'Instagram Post'} style={{ maxWidth: '200px', margin: '10px' }} />
                    </div>
                ))}

              </Card>

            </Layout.Section>
      </Layout>
    </Page>
  );
}
