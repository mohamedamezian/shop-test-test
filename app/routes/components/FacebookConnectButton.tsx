import { Button } from "@shopify/polaris";

export function FacebookConnectButton() {
    return (
        <Button
            onClick={() => {
                window.open("/app/facebook", "_parent")
            }}>
            Connect Facebook
        </Button>
    )
}