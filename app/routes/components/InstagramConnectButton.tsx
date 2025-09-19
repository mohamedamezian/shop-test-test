import { Button
 } from "@shopify/polaris";

 export function InstagramConnectButton(){

    return(
        <Button
        onClick={() => {
            window.open("/instagram")
        }}>Connect Instagram</Button>
    )


 }