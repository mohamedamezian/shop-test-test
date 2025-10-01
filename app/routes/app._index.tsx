import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { AppProvider } from "@shopify/polaris";
import translations from "@shopify/polaris/locales/en.json";
import { FacebookConnectButton } from "./components/FacebookConnectButton";
import { InstagramConnectButton } from "./components/InstagramConnectButton";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return json({ shop: session.shop });
};

export default function Index() {
  const { shop } = useLoaderData<typeof loader>();

  return (
    <AppProvider i18n={translations}>
      <div style={{ padding: "2rem" }}>
        <h1>Welcome to your app 🎉</h1>
        <FacebookConnectButton />
        <InstagramConnectButton shop={shop} />
      </div>
    </AppProvider>
  );
}
