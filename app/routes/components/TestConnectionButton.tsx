import { useFetcher } from "@remix-run/react";
import { Button } from "@shopify/polaris";

export function TestConnectionButton({ provider }: { provider: string }) {
  const fetcher = useFetcher<any>();

  return (
    <div>
      <Button 
        onClick={() => fetcher.submit({ provider }, { method: "POST", action: "/api/test-connection" })} 
        loading={fetcher.state !== "idle"}
        size="slim"
      >
        Test {provider}
      </Button>
      
      {fetcher.data && (
        <p style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>
          {fetcher.data.success ? "✅ Working" : "❌ " + fetcher.data.error}
        </p>
      )}
    </div>
  );
}
