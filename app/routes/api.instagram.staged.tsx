import { LoaderFunctionArgs } from "@remix-run/node";
import prisma from "app/db.server";
import { authenticate } from "app/shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

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
                    ... on Video {
                        originalSource {
                            fileSize
                            url
                            mimeType
                        }
                    }
            } userErrors {
                field
                message
            }
        }
        }`;

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
};
