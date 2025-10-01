import { Button } from "@shopify/polaris";
import { useNavigate } from "@remix-run/react";

export function FacebookConnectButton() {
    const navigate = useNavigate();

    return (
        <Button
            onClick={() => {
                navigate("/facebook");
            }}
        >
            Connect Facebook
        </Button>
    );
}