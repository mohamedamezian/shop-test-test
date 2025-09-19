import { LoaderFunction } from "@remix-run/node";

export const loader: LoaderFunction = async ({ request }) => {
  // Facebook redirects here after login with a code in the query string
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) {
    return new Response("No code provided", { status: 400 });
  }
  // Here you would exchange the code for an access token using Facebook's API
  // and handle user authentication/session creation
  return new Response(`Facebook login successful! Code: ${code}`);
};

export default function FacebookCallback() {
  return <div>Facebook login callback received.</div>;
}
