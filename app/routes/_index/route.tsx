import type { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData, useNavigate } from "@remix-run/react";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import { authenticate } from "../../shopify.server";
import { Button } from "@shopify/polaris";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function Index() {
  const { apiKey } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const goToApp = () => {
    // Use Remix navigate (which works with App Bridge in embedded context)
    navigate("/app");
  };

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <ui-nav-menu>
        <a href="/" rel="home">
          Home
        </a>
        <a href="/app">App Dashboard</a>
        <a href="/app/social-status">Social Status</a>
        <a href="/app/instagram-test">Instagram Test</a>
      </ui-nav-menu>

      <div style={{ padding: "2rem" }}>
        <h1>Welcome to your app 🎉</h1>
        <p>This is the landing page of your Shopify app.</p>
        <div style={{ marginTop: "1rem" }}>
          <Button variant="primary" onClick={goToApp}>
            Go to App Dashboard
          </Button>
        </div>
      </div>
    </AppProvider>
  );
}
