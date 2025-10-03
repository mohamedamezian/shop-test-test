import { Button } from "@shopify/polaris";

export function FacebookConnectButton({ shop }: { shop: string }) {
    const handleConnect = () =>{
        window.open(`/facebook?shop=${encodeURIComponent(shop)}`, "_blank", "width=600,height=700");
    }
    return (
        <Button onClick={handleConnect}>
            Connect Facebook
        </Button>
    )
}