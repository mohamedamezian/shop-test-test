import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary, shopifyApp } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { authenticate } from "../shopify.server";
import { useEffect } from "react";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  // Using the shopify global variable

  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <s-app-nav>
        <Link to="/app" aria-label="Home">
          Home
        </Link>
        <Link to="/app/social-status" aria-label="Social Status">
          Social Status
        </Link>
        <Link to="/app/instagram-test" aria-label="Instagram Test">
          Instagram Test
        </Link>
        <Link to="/app/instagram-tester" aria-label="Instagram Tester">
          Instagram Tester
        </Link>
        <Link to="/app/auth-test" aria-label="Authentication Test">
          Authentication Test
        </Link>
        <Link to="/app/debug" aria-label="Debug">
          Debug
        </Link>
        <Link
          to="/api/delete-instagram-data"
          aria-label="Delete Instagram Data"
        >
          Delete data
        </Link>
      </s-app-nav>

      <Outlet />
    </AppProvider>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
