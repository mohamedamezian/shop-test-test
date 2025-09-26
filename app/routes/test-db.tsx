import type { LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Create a test session record
    const testSession = await prisma.session.create({
      data: {
        id: `test_${Date.now()}`,
        shop: "test-shop.myshopify.com",
        state: "test-state",
        accessToken: "test-token-123",
        isOnline: false,
      },
    });

    return new Response(
      `<h2>Test Successful!</h2>
       <p>Created session with ID: ${testSession.id}</p>
       <p>Shop: ${testSession.shop}</p>
       <p>Database connection is working! 🎉</p>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (error) {
    console.error("Database test failed:", error);
    return new Response(
      `<h2>Database Test Failed</h2>
       <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>`,
      { 
        status: 500,
        headers: { "Content-Type": "text/html" } 
      }
    );
  }
};
