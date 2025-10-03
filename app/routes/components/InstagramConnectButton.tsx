import { Button } from "@shopify/polaris";

export function InstagramConnectButton({ shop }: { shop: string }) {
    const handleConnect = () => {
        window.open(`/instagram?shop=${encodeURIComponent(shop)}`, "_parent", "width=600,height=700");
    };

    return (
        <Button onClick={handleConnect}>
            Connect Instagram
        </Button>
    )
}