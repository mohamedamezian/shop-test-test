import { Button } from "@shopify/polaris";
import { useNavigate } from "@remix-run/react";

export function InstagramConnectButton() {
    const navigate = useNavigate();

    return (
        <Button
            onClick={() => {
                navigate("app/instagram");
            }}
        >
            Connect Instagram
        </Button>
    );
}