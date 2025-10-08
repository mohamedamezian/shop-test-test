import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Layout } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { InstagramPostsViewer } from "./components/InstagramPostsViewer";

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

    return (
        <Page title="Instagram Graph API Tester">
            <Layout>
                <Layout.Section>
                    <InstagramPostsViewer />
                </Layout.Section>
            </Layout>
        </Page>
    );
}
