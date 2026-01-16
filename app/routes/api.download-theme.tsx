import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import fs from 'fs';
import path from 'path';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  try {
    // Path to the zip file in public directory
    const zipPath = path.resolve(process.cwd(), 'public', 'nn-instagram-theme.zip');
    
    // Check if zip file exists
    if (!fs.existsSync(zipPath)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Theme files not found. Please run 'npm run create-theme-zip' first." 
        }), 
        { 
          status: 404,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
    
    // Read the zip file
    const zipBuffer = fs.readFileSync(zipPath);
    
    // Return the zip file as a downloadable response
    return new Response(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=nn-instagram-theme.zip",
        "Content-Length": zipBuffer.length.toString()
      }
    });
  } catch (error) {
    console.error("Error serving zip file:", error);
    return new Response(
      JSON.stringify({ success: false, message: "Failed to download theme files" }), 
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};
