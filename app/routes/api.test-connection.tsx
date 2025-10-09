import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const provider = formData.get("provider") as string;

  const account = await prisma.socialAccount.findUnique({
    where: {
      shop_provider: {
        shop: session.shop,
        provider: provider
      }
    }
  });

  if (!account?.accessToken) {
    return { error: `No ${provider} connected` };
  }

  const testUrl = provider === "instagram" 
    ? `https://graph.instagram.com/me?fields=id,username&access_token=${account.accessToken}`
    : `https://graph.facebook.com/me?access_token=${account.accessToken}`;

  const response = await fetch(testUrl);
  const data = await response.json();

  return { 
    success: !data.error,
    message: data.error ? data.error.message : `${provider} working`
  };
};
