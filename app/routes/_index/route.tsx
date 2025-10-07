import type { LoaderFunctionArgs } from "@remix-run/node";
import {useLoaderData, useLocation, useNavigate } from "@remix-run/react";
import { AppProvider } from "@shopify/shopify-app-remix/react";

import { authenticate } from "../../shopify.server";
import { Button } from "@shopify/polaris";
import { useEffect } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function Index() {
  const { apiKey } = useLoaderData<typeof loader>();
  const navigate = useNavigate();


  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
    
        {/* <a href="/" rel="home">
          Home
        </a>
        <a href="/app">App Dashboard</a>
        <a href="/app/social-status">Social Status</a>
        <a href="/app/instagram-test">Instagram Test</a> */}


      <div style={{ padding: "2rem" }}>
        <h1>Welcome to your app 🎉</h1>
        <p>This is the landing page of your Shopify app.</p>
        <div style={{ marginTop: "1rem" }}>
          <Button variant="primary" onClick={() => navigate("/app")}>
            Go to App Dashboard
          </Button>
        </div>
      </div>
    </AppProvider>
  );
}
