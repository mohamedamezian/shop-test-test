import { Button
 } from "@shopify/polaris";

 export function FacebookConnectButton(){

    return(
        <Button
        onClick={() => {
            window.open("/facebook")
        }}>Connect Facebook</Button>
    )


 }