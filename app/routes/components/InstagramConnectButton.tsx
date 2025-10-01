import { Button } from "@shopify/polaris";

interface InstagramConnectButtonProps {
    shop?: string;
}

export function InstagramConnectButton({ shop }: InstagramConnectButtonProps) {
    const handleConnect = () => {
        if (!shop) {
            console.error('No shop provided to Instagram button');
            return;
        }
        window.open(`/instagram?shop=${encodeURIComponent(shop)}`, "_blank", "width=600,height=700");
    };

    return (
        <Button onClick={handleConnect}>
            Connect Instagram
        </Button>
    )
}