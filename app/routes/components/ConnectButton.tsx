import { Button
 } from "@shopify/polaris";

 export function ConnectButton({type} : {type: "facebook" | "instagram"}){
    const label = type === "facebook" ? "Connect Facebook" : "Connect Instagram";

    return(
        <Button
        onClick={() => {
            window.open(`/redirectHandler?type=${type}`)
        }}>{label}</Button>
    )


 }