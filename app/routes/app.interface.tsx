import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  useLoaderData,
  useSubmit,
  useNavigation,
  useFetcher,
} from "react-router";
import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import type { LoaderData, InstagramAccount } from "../types/instagram.types";
import {
  getInstagramProfile,
  getSyncStats,
  getThemePages,
} from "../utils/instagram.server";
import {
  handleSyncAction,
  handleDeleteDataAction,
  handleDisconnectAction,
  handleAddToThemeAction,
} from "../utils/actions.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  // Get Instagram account info
  const socialAccount = await prisma.socialAccount.findUnique({
    where: {
      shop_provider: {
        shop: session.shop,
        provider: "instagram",
      },
    },
  });

  let instagramAccount: InstagramAccount | null = null;
  let syncStats = {
    lastSyncTime: null as string | null,
    postsCount: 0,
    filesCount: 0,
    metaobjectsCount: 0,
  };

  if (socialAccount) {
    // Fetch Instagram profile info
    const profile = await getInstagramProfile(socialAccount.accessToken);
    if (profile) {
      instagramAccount = {
        ...profile,
        connectedAt: socialAccount.createdAt.toISOString(),
      };
    }

    // Get sync statistics from Shopify
    syncStats = await getSyncStats(admin);
  }

  // Fetch theme pages (templates) for app block installation
  const themePages = await getThemePages(admin);

  return {
    shop: session.shop,
    instagramAccount,
    syncStats,
    isConnected: !!socialAccount,
    themePages,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("action");

  if (actionType === "sync") {
    return await handleSyncAction(request);
  }

  if (actionType === "delete-data") {
    return await handleDeleteDataAction(admin);
  }

  if (actionType === "disconnect") {
    return await handleDisconnectAction(admin, session.shop);
  }

  if (actionType === "add-to-theme") {
    const selectedTemplate = formData.get("template") as string;
    return await handleAddToThemeAction(session.shop, selectedTemplate);
  }

  return { success: false, message: "Invalid action", status: 400 };
};

export default function Index() {
  const { shop, instagramAccount, syncStats, isConnected, themePages } =
    useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const fetcher = useFetcher();
  const syncFetcher = useFetcher();
  const themeFetcher = useFetcher();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>("");
  const [syncProgress, setSyncProgress] = useState(0);
  const [deleteMessage, setDeleteMessage] = useState<string>("");
  const [selectedPage, setSelectedPage] = useState<string>("index");

  const isActionRunning =
    navigation.state === "submitting" || fetcher.state === "submitting";

  // Handle fetcher response (for delete/disconnect actions)
  useEffect(() => {
    if (fetcher.data && fetcher.state === "idle") {
      const data = fetcher.data as {
        success?: boolean;
        deletedMetaobjects?: number;
        deletedFiles?: number;
        message?: string;
      };
      if (data.success) {
        // Show success message with details
        if (
          data.deletedMetaobjects !== undefined &&
          data.deletedFiles !== undefined
        ) {
          setDeleteMessage(
            `✓ Successfully deleted ${data.deletedMetaobjects} metaobjects and ${data.deletedFiles} files`,
          );

          // Auto-dismiss message after 5 seconds
          setTimeout(() => {
            setDeleteMessage("");
          }, 5000);
        }
        // Don't reload - the fetcher automatically revalidates the loader
        // This keeps the Shopify session intact
      }
    }
  }, [fetcher.data, fetcher.state]);

  const handleSync = () => {
    setIsSyncing(true);
    setSyncStatus("Connecting to Instagram...");
    setSyncProgress(10);

    // Use fetcher to call the sync endpoint
    syncFetcher.load("/api/instagram/staged-upload");
  };

  // Handle sync fetcher response
  useEffect(() => {
    if (syncFetcher.state === "loading" && isSyncing) {
      setSyncStatus("Fetching Instagram posts...");
      setSyncProgress(30);
    }

    if (syncFetcher.state === "idle" && syncFetcher.data && isSyncing) {
      const result = syncFetcher.data as any;

      // Check if there was an error in the response
      if (result.error) {
        setSyncStatus(`❌ ${result.error}`);
        setSyncProgress(0);
        setTimeout(() => setIsSyncing(false), 5000);
        return;
      }

      // Success!
      setSyncStatus("Uploading media files to Shopify...");
      setSyncProgress(60);

      setTimeout(() => {
        setSyncStatus("Creating metaobjects...");
        setSyncProgress(80);

        setTimeout(() => {
          setSyncProgress(100);
          setSyncStatus("✓ Sync completed successfully!");

          // Reset and let the fetcher auto-revalidate the loader
          setTimeout(() => {
            setIsSyncing(false);
            setSyncStatus("");
            setSyncProgress(0);
          }, 2000);
        }, 1500);
      }, 2000);
    }
  }, [syncFetcher.state, syncFetcher.data, isSyncing]);

  // Handle theme fetcher response
  useEffect(() => {
    if (themeFetcher.state === "idle" && themeFetcher.data) {
      const result = themeFetcher.data as any;
      if (result.success && result.redirectUrl) {
        // Open the theme editor in a new tab
        window.open(result.redirectUrl, "_blank");
      }
    }
  }, [themeFetcher.state, themeFetcher.data]);

  const handleConnect = () => {
    window.open(
      `/instagram?shop=${encodeURIComponent(shop)}`,
      "_parent",
      "width=600,height=700",
    );
  };

  const handleSwitchAccount = () => {
    window.open(
      `/instagram?shop=${encodeURIComponent(shop)}`,
      "_parent",
      "width=600,height=700",
    );
  };

  const handleDeleteData = () => {
    if (
      confirm(
        "Are you sure you want to delete all Instagram posts, files, and metaobjects? This cannot be undone.",
      )
    ) {
      const formData = new FormData();
      formData.append("action", "delete-data");
      fetcher.submit(formData, { method: "post" });
    }
  };

  const handleDisconnect = () => {
    if (
      confirm(
        "Are you sure you want to disconnect your Instagram account? This will delete all synced data and cannot be undone.",
      )
    ) {
      const formData = new FormData();
      formData.append("action", "disconnect");
      fetcher.submit(formData, { method: "post" });
    }
  };

  const handleAddToTheme = () => {
    if (!selectedPage) {
      alert("Please select a page first");
      return;
    }

    const formData = new FormData();
    formData.append("action", "add-to-theme");
    formData.append("template", selectedPage);
    themeFetcher.submit(formData, { method: "post" });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60)
      return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  };

  return (
    <s-page>
      {/* Delete Success Banner */}
      {deleteMessage && (
        <s-section>
          <s-banner tone="success" onDismiss={() => setDeleteMessage("")}>
            {deleteMessage}
          </s-banner>
        </s-section>
      )}

      {/* Manual Sync Card */}
      {isConnected && (
        <s-section>
          <s-banner tone="info">
            Your Instagram posts sync automatically every 24 hours. Use the
            "Sync Now" button above to manually fetch the latest posts.
          </s-banner>
          <s-card>
            <s-stack gap="base">
              <s-stack gap="small-500">
                <s-heading>Instagram Sync</s-heading>

                <s-text color="subdued">
                  Fetch and sync your latest Instagram posts to Shopify
                </s-text>
              </s-stack>

              {isSyncing && (
                <s-stack gap="base">
                  <s-stack gap="small-200" direction="inline">
                    <s-spinner />
                    <s-text>{syncStatus}</s-text>
                  </s-stack>
                  {syncProgress > 0 && (
                    <div
                      style={{
                        width: "100%",
                        height: "4px",
                        background: "#e1e1e1",
                        borderRadius: "2px",
                      }}
                    >
                      <div
                        style={{
                          width: `${syncProgress}%`,
                          height: "100%",
                          background: "#008060",
                          borderRadius: "2px",
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                  )}
                </s-stack>
              )}

              {!isSyncing && (
                <s-stack gap="small-100">
                  <s-box>
                    <s-button
                      onClick={handleSync}
                      loading={isSyncing}
                      disabled={isActionRunning}
                    >
                      Sync Now
                    </s-button>
                  </s-box>
                  {syncStats.lastSyncTime && (
                    <s-text color="subdued">
                      Last synced {formatDate(syncStats.lastSyncTime)}
                    </s-text>
                  )}
                </s-stack>
              )}
            </s-stack>
          </s-card>
        </s-section>
      )}

      {/* Connection Status */}
      <s-section>
        <s-card>
          <s-stack gap="base">
            <s-stack direction="inline" gap="small-200">
              <s-heading>Instagram Account</s-heading>
              {isConnected ? (
                <s-badge tone="success">Connected</s-badge>
              ) : (
                <s-badge tone="critical">Not Connected</s-badge>
              )}
            </s-stack>

            {isConnected && instagramAccount ? (
              <s-stack gap="base">
                <s-stack gap="base" direction="inline">
                  {instagramAccount.profilePicture && (
                    <s-thumbnail
                      src={instagramAccount.profilePicture}
                      alt={instagramAccount.username}
                      size="large"
                    />
                  )}
                  <s-stack gap="small-100">
                    <s-text type="strong">@{instagramAccount.username}</s-text>
                    <s-text color="subdued">
                      User ID: {instagramAccount.userId}
                    </s-text>
                    <s-text color="subdued">
                      Connected {formatDate(instagramAccount.connectedAt)}
                    </s-text>
                  </s-stack>
                </s-stack>

                <s-divider />

                <s-stack gap="small-200" direction="inline">
                  <s-button
                    onClick={handleSwitchAccount}
                    disabled={isSyncing || isActionRunning}
                  >
                    Switch Account
                  </s-button>
                  <s-button
                    onClick={handleDeleteData}
                    tone="critical"
                    loading={
                      fetcher.state === "submitting" &&
                      fetcher.formData?.get("action") === "delete-data"
                    }
                    disabled={isSyncing || isActionRunning}
                  >
                    Delete Data
                  </s-button>
                  <s-button
                    onClick={handleDisconnect}
                    tone="critical"
                    loading={
                      fetcher.state === "submitting" &&
                      fetcher.formData?.get("action") === "disconnect"
                    }
                    disabled={isSyncing || isActionRunning}
                  >
                    Disconnect
                  </s-button>
                </s-stack>
              </s-stack>
            ) : (
              <s-stack gap="base">
                <s-text>
                  Connect your Instagram Business account to sync posts to
                  Shopify metaobjects and files.
                </s-text>
                <s-box>
                  <s-button variant="primary" onClick={handleConnect}>
                    Connect Instagram Account
                  </s-button>
                </s-box>
              </s-stack>
            )}
          </s-stack>
        </s-card>
      </s-section>

      {/* Sync Statistics */}
      {isConnected && (
        <>
          <s-section>
            <s-card>
              <s-stack gap="base">
                <s-heading>Sync Statistics</s-heading>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "16px",
                  }}
                >
                  {/* Posts Card */}
                  <s-clickable
                    href={`https://admin.shopify.com/store/${shop.replace(
                      ".myshopify.com",
                      "",
                    )}/content/metaobjects/entries/instagram-post`}
                    target="_blank"
                    border="base"
                    borderRadius="base"
                    padding="base"
                  >
                    <s-stack gap="small-200">
                      <s-icon type="social-post" tone="info" />
                      <div style={{ fontSize: "28px", fontWeight: "600" }}>
                        {syncStats.postsCount}
                      </div>
                      <s-text color="subdued">Posts Synced</s-text>
                    </s-stack>
                  </s-clickable>

                  {/* Files Card */}
                  <s-clickable
                    href={`https://admin.shopify.com/store/${shop.replace(
                      ".myshopify.com",
                      "",
                    )}/content/files?selectedView=all&media_type=IMAGE%2CVIDEO&query=instagram`}
                    target="_blank"
                    border="base"
                    borderRadius="base"
                    padding="base"
                  >
                    <s-stack gap="small-200">
                      <s-icon type="image" tone="success" />
                      <div style={{ fontSize: "28px", fontWeight: "600" }}>
                        {syncStats.filesCount}
                      </div>
                      <s-text color="subdued">Files Created</s-text>
                    </s-stack>
                  </s-clickable>

                  {/* Metaobjects Card */}
                  <s-clickable
                    href={`https://admin.shopify.com/store/${shop.replace(
                      ".myshopify.com",
                      "",
                    )}/content/metaobjects`}
                    target="_blank"
                    border="base"
                    borderRadius="base"
                    padding="base"
                  >
                    <s-stack gap="small-200">
                      <s-icon type="file" tone="warning" />
                      <div style={{ fontSize: "28px", fontWeight: "600" }}>
                        {syncStats.metaobjectsCount}
                      </div>
                      <s-text color="subdued">Metaobjects</s-text>
                    </s-stack>
                  </s-clickable>
                </div>
              </s-stack>
            </s-card>
          </s-section>

          {/* Theme App Extension - Enable App Block */}
          <s-section>
            <s-card>
              <s-stack gap="base">
                <s-stack gap="small-200">
                  <s-heading>Add Instagram Feed to Your Theme</s-heading>
                  <s-text color="subdued">
                    Choose a page and add the Instagram Feed app block with one
                    click
                  </s-text>
                </s-stack>

                <s-banner tone="info">
                  <s-stack gap="small-500">
                    <s-text type="strong">How it works</s-text>
                    <s-text>1. Select a page from the dropdown below</s-text>
                    <s-text>
                      2. Click "Add to Theme" to open the Theme Editor
                    </s-text>
                    <s-text>
                      3. The Instagram Feed block will be ready to add to your
                      selected page
                    </s-text>
                  </s-stack>
                </s-banner>

                <s-stack gap="base">
                  <s-stack gap="small-200">
                    <s-text type="strong">Select a page:</s-text>
                    <select
                      value={selectedPage}
                      onChange={(e) => setSelectedPage(e.target.value)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "4px",
                        border: "1px solid #c9cccf",
                        fontSize: "14px",
                        width: "100%",
                        maxWidth: "300px",
                        cursor: "pointer",
                      }}
                    >
                      {themePages.map((page) => (
                        <option key={page.value} value={page.value}>
                          {page.label}
                        </option>
                      ))}
                    </select>
                  </s-stack>

                  <s-stack gap="small-200" direction="inline">
                    <s-button
                      variant="primary"
                      onClick={handleAddToTheme}
                      loading={themeFetcher.state === "submitting"}
                    >
                      Add to Theme
                    </s-button>

                    <s-clickable
                      href={`https://admin.shopify.com/store/${shop.replace(
                        ".myshopify.com",
                        "",
                      )}/themes`}
                      target="_blank"
                    >
                      <s-button>View All Themes</s-button>
                    </s-clickable>
                  </s-stack>
                </s-stack>

                <s-divider />

                <s-stack gap="small-200">
                  <s-text type="strong">What's included:</s-text>
                  <s-text>
                    • Instagram Carousel - A beautiful, responsive carousel
                    displaying your synced posts
                  </s-text>
                  <s-text>
                    • Fully customizable styling and layout options in the Theme
                    Editor
                  </s-text>
                  <s-text>
                    • Automatic updates when you sync new Instagram posts
                  </s-text>
                </s-stack>
              </s-stack>
            </s-card>
          </s-section>

          {/* Theme Snippets Download Section */}
          <s-section>
            <s-card>
              <s-stack gap="base">
                <s-stack gap="small-200">
                  <s-heading>Theme Integration</s-heading>
                  <s-text color="subdued">
                    Download ready-to-use Liquid snippets for your Shopify theme
                  </s-text>
                </s-stack>

                <s-banner tone="info">
                  Coming soon: Download pre-built theme snippets to quickly add
                  Instagram feeds to your store
                </s-banner>
              </s-stack>
            </s-card>
          </s-section>

          {/* Developer Guide */}
          <s-section>
            <s-card>
              <s-stack gap="base">
                <s-heading>Developer Guide</s-heading>

                <s-text color="subdued">
                  Access the synced Instagram posts in your theme with this
                  simple Liquid code.
                </s-text>

                <s-divider />

                <s-stack gap="small-200">
                  <s-text type="strong">Accessing the Data</s-text>
                  <s-box
                    padding="base"
                    background="subdued"
                    borderRadius="base"
                  >
                    <pre
                      style={{
                        fontSize: "12px",
                        lineHeight: "1.5",
                        overflow: "auto",
                        margin: 0,
                        fontFamily: "monospace",
                      }}
                    >
                      {`{% assign instagram = metaobjects['instagram-list']['instagram-feed-list'] %}

{% for post in instagram.posts.value %}
  {{ post.caption.value }}
  {{ post.likes.value }}
  {{ post.comments.value }}
  
  {% for media in post.images.value %}
    {{ media | image_url: width: 800 }}
  {% endfor %}
{% endfor %}`}
                    </pre>
                  </s-box>
                </s-stack>

                <s-divider />

                <s-stack gap="small-200">
                  <s-text type="strong">Available Fields</s-text>
                  <s-text color="subdued">
                    Each post includes: caption, likes, comments, images, and
                    permalink
                  </s-text>
                </s-stack>

                <s-banner tone="info">
                  <s-text>
                    Click the statistics cards above to view your metaobjects in
                    Shopify admin and explore all fields.
                  </s-text>
                </s-banner>
              </s-stack>
            </s-card>
          </s-section>
        </>
      )}
    </s-page>
  );
}
export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
