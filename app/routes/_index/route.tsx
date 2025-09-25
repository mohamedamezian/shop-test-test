import { AppProvider } from "@shopify/polaris";
import translations from "@shopify/polaris/locales/en.json";
import { FacebookConnectButton } from "../components/FacebookConnectButton";
import { InstagramConnectButton } from "../components/InstagramConnectButton";
import { ConnectButton } from "../components/ConnectButton";

export default function Index() {
  return (
    <AppProvider i18n={translations}>
      <div style={{ padding: "2rem" }}>
        <h1>Welcome to your app 🎉</h1>
        <ConnectButton type="facebook" />
        <ConnectButton type="instagram" />
      </div>
    </AppProvider>
  );
}
