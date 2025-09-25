
import { LoaderFunction, redirect } from "@remix-run/node";

export const loader: LoaderFunction = async ({request}) => {
    const url = new URL(request.url);
    const type = url.searchParams.get("type");

    //Facebook variables
    const FBappId = process.env.FACEBOOK_APP_ID!;
    const FBredirectUri = process.env.REDIRECT_URI!;
    const FBscope = process.env.FACEBOOK_SCOPES!;
    const FBauthUrl = `https://www.facebook.com/v23.0/dialog/oauth?client_id=${FBappId}&redirect_uri=${encodeURIComponent(FBredirectUri)}&scope=${encodeURIComponent(FBscope)}&response_type=code`;

    //Instagram variables
    const IGappId = process.env.INSTAGRAM_APP_ID!;
    const IGredirectUri = process.env.REDIRECT_URI!;
    const IGscope = process.env.INSTA_SCOPES!;
    const IGauthUrl = `https://www.instagram.com/oauth/authorize?force_reauth=true&client_id=${IGappId}&redirect_uri=${encodeURIComponent(IGredirectUri)}&response_type=code&scope=${encodeURIComponent(IGscope)}`;

    return type === "facebook" ? redirect(FBauthUrl + `&type=${type}`) : redirect(IGauthUrl + `&type=${type}`);

};