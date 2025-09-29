import prisma from "../db.server";

export interface TokenRefreshResult {
  success: boolean;
  newToken?: string;
  expiresAt?: Date;
  error?: string;
}

export async function refreshFacebookToken(currentToken: string): Promise<TokenRefreshResult> {
  try {
    // Facebook long-lived token refresh
    const refreshUrl = `https://graph.facebook.com/v23.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_APP_ID}&client_secret=${process.env.FACEBOOK_APP_SECRET}&fb_exchange_token=${currentToken}`;
    
    const response = await fetch(refreshUrl, { method: "GET" });
    const data = await response.json();

    if (data.access_token) {
      return {
        success: true,
        newToken: data.access_token,
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      };
    } else {
      return {
        success: false,
        error: `Facebook refresh failed: ${JSON.stringify(data)}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `Facebook refresh error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export async function refreshInstagramToken(currentToken: string): Promise<TokenRefreshResult> {
  try {
    // Instagram long-lived token refresh
    const refreshUrl = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${currentToken}`;
    
    const response = await fetch(refreshUrl, { method: "GET" });
    const data = await response.json();

    if (data.access_token) {
      return {
        success: true,
        newToken: data.access_token,
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      };
    } else {
      return {
        success: false,
        error: `Instagram refresh failed: ${JSON.stringify(data)}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `Instagram refresh error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export async function refreshExpiredTokens(shop: string): Promise<void> {
  console.log(`Checking expired tokens for shop: ${shop}`);
  
  // Find tokens expiring in the next 7 days
  const soonToExpire = new Date();
  soonToExpire.setDate(soonToExpire.getDate() + 7);
  
  const expiredTokens = await prisma.socialAccount.findMany({
    where: {
      shop,
      expiresAt: {
        lte: soonToExpire,
      },
    },
  });

  for (const account of expiredTokens) {
    console.log(`Refreshing ${account.provider} token for ${account.shop}`);
    
    let result: TokenRefreshResult;
    
    if (account.provider === "facebook") {
      result = await refreshFacebookToken(account.accessToken);
    } else if (account.provider === "instagram") {
      result = await refreshInstagramToken(account.accessToken);
    } else {
      console.log(`Unknown provider: ${account.provider}`);
      continue;
    }

    if (result.success && result.newToken) {
      // Update the token in database
      await prisma.socialAccount.update({
        where: { id: account.id },
        data: {
          accessToken: result.newToken,
          expiresAt: result.expiresAt,
        },
      });
      console.log(`Successfully refreshed ${account.provider} token`);
    } else {
      console.error(`Failed to refresh ${account.provider} token:`, result.error);
    }
  }
}
