import { LoaderFunctionArgs } from "@remix-run/node";
const ig_current_token = "IGQVJYd1ZA3ZA1ZA3ZA3ZA3ZA3ZA3ZA3ZA3ZA3ZA3ZA3ZA3ZA3ZA3ZA3ZA3ZA3ZA3ZA3ZA3ZA3ZA3ZA3ZA3ZAFZA1ZAF9mZA1ZAF9mZA1ZAF9mZA1ZAF9mZA1ZAF9mZA1ZAF9mZD";

const updateIGToken = async (current_token : string) => {
  // Instagram token update request
  const setTokenURequest = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${current_token}`, {
    method: "GET",
    });
    const data = await setTokenURequest.json();     
    console.log("Tokens updated");
};

const updateFBToken = async (current_token : string) => {
  // Facebook token update request
  const setTokenURequest = await fetch(`https://graph.facebook.com/refresh_access_token?grant_type=fb_refresh_token&access_token=${current_token}`, {
    method: "GET",
    });
    const data = await setTokenURequest.json();
    console.log("Tokens updated");
};




export const loader = async (args: LoaderFunctionArgs) => {
  await updateIGToken(ig_current_token);
  await updateFBToken(ig_current_token);

  return new Response("Tokens updated", { status: 200 });
};