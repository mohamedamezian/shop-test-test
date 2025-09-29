import prisma from "app/db.server";
import { LoaderFunctionArgs } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    try{
        //
        const refreshUrl = "https://graph.instagram.com/refresh_access_token"


        const currentIgToken = await prisma.socialAccount.findMany({
            where:{
                provider: "instagram",
                shop: "shop-test-test.vercel.app",
                createdAt: {
                    lt: new Date(Date.now() - 24 * 60 * 60 * 1000) 
                }
            }
        })

        for(const token of currentIgToken){
            const res = await fetch(`${refreshUrl}?grant_type=ig_refresh_token&access_token=${token.accessToken}`,{
                method: "GET"
                // No body for GET requests
            });
            const data = await res.json();
            if(data.access_token){
                await prisma.socialAccount.upsert({

                    where: {
                        shop_provider: {
                            shop: token.shop,
                            provider: token.provider
                        }
                    },
                    update: {
                        accessToken: data.access_token,
                        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
                    },
                    create: {
                        shop: token.shop,
                        provider: token.provider,
                        accessToken: data.access_token,
                        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
                    },
                });
            } else {
                console.error(`Failed to refresh token for ${token.shop}: ${JSON.stringify(data)}`);
            }
        }
        

        return new Response("Cron job completed", {status: 200},
        );

    }
    catch(error){
        console.error("Error in cron job:", error);
        return new Response(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, {status: 500});
    }
}
            