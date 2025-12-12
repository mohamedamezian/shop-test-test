import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  useLoaderData,
  useSubmit,
  useNavigation,
  useFetcher,
} from "@remix-run/react";
import { useState, useEffect } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  BlockStack,
  InlineStack,
  Badge,
  Thumbnail,
  Box,
  Divider,
  Icon,
  Banner,
  Link,
  ProgressBar,
  Spinner,
} from "@shopify/polaris";
import {
  RefreshIcon,
  LogoInstagramIcon,
  CalendarIcon,
  ImageIcon,
  FileIcon,
  CheckIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

interface SyncStats {
  lastSyncTime: string | null;
  postsCount: number;
  filesCount: number;
  metaobjectsCount: number;
}

interface InstagramAccount {
  username: string;
  userId: string;
  profilePicture?: string;
  connectedAt: string;
}

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
  let syncStats: SyncStats = {
    lastSyncTime: null,
    postsCount: 0,
    filesCount: 0,
    metaobjectsCount: 0,
  };

  if (socialAccount) {
    // Fetch Instagram profile info
    try {
      const profileResponse = await fetch(
        `https://graph.instagram.com/me?fields=id,username,media_count&access_token=${socialAccount.accessToken}`,
      );
      const profileData = await profileResponse.json();

      instagramAccount = {
        username: profileData.username || "Unknown",
        userId: profileData.id,
        connectedAt: socialAccount.createdAt.toISOString(),
      };
    } catch (error) {
      console.error("Error fetching Instagram profile:", error);
    }

    // Get sync statistics from Shopify
    try {
      // Count instagram-post metaobjects (type filter ensures only instagram-post type)
      const postsCountQuery = await admin.graphql(`#graphql
        query {
          metaobjects(type: "instagram-post", first: 250) {
            nodes {
              id
            }
          }
        }
      `);
      const postsCountData = await postsCountQuery.json();

      // Get instagram-list metaobject and last sync time
      const listQuery = await admin.graphql(`#graphql
        query {
          metaobjects(type: "instagram-list", first: 1) {
            nodes {
              id
              fields {
                key
                value
              }
              updatedAt
            }
          }
        }
      `);
      const listData = await listQuery.json();

      // Count files with instagram-post prefix in alt text
      // Using "instagram-post_" prefix to match our file naming convention
      const filesCountQuery = await admin.graphql(`#graphql
        query {
          files(first: 250, query: "alt:instagram-post_") {
            edges {
              node {
                id
                alt
              }
            }
          }
        }
      `);
      const filesCountData = await filesCountQuery.json();

      // Filter files to only those starting with "instagram"
      const instagramFiles =
        filesCountData.data?.files?.edges?.filter((edge: any) =>
          edge.node.alt?.startsWith("instagram"),
        ) || [];

      // Calculate metaobjects count: posts + list (if exists)
      const postsCount = postsCountData.data?.metaobjects?.nodes?.length || 0;
      const hasListMetaobject =
        (listData.data?.metaobjects?.nodes?.length || 0) > 0;

      syncStats = {
        lastSyncTime: listData.data?.metaobjects?.nodes?.[0]?.updatedAt || null,
        postsCount: postsCount,
        filesCount: instagramFiles.length,
        metaobjectsCount: postsCount + (hasListMetaobject ? 1 : 0),
      };
    } catch (error) {
      console.error("Error fetching sync stats:", error);
    }
  }

  return json({
    shop: session.shop,
    instagramAccount,
    syncStats,
    isConnected: !!socialAccount,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("action");

  if (actionType === "sync") {
    try {
      // Trigger the sync by calling the instagram sync endpoint
      const syncUrl = new URL(request.url);
      syncUrl.pathname = "/api/instagram/staged-upload";

      const response = await fetch(syncUrl.toString(), {
        headers: {
          Cookie: request.headers.get("Cookie") || "",
        },
      });

      if (!response.ok) {
        throw new Error("Sync failed");
      }

      return json({ success: true, message: "Sync completed successfully!" });
    } catch (error) {
      return json(
        { success: false, message: "Sync failed. Please try again." },
        { status: 500 },
      );
    }
  }

  if (actionType === "delete-data") {
    try {
      // Delete all Instagram data directly
      // Query instagram_post metaobjects
      const postMetaobjectsQuery = await admin.graphql(`
        #graphql
        query {
          metaobjects(type: "instagram-post", first: 250) {
            edges { node { id } }
          }
        }
      `);
      const postMetaobjectsJson = await postMetaobjectsQuery.json();
      const postMetaobjectIds =
        postMetaobjectsJson.data?.metaobjects?.edges?.map(
          (e: any) => e.node.id,
        ) || [];

      // Query instagram_list metaobjects
      const listMetaobjectsQuery = await admin.graphql(`
        #graphql
        query {
          metaobjects(type: "instagram-list", first: 10) {
            edges { node { id } }
          }
        }
      `);
      const listMetaobjectsJson = await listMetaobjectsQuery.json();
      const listMetaobjectIds =
        listMetaobjectsJson.data?.metaobjects?.edges?.map(
          (e: any) => e.node.id,
        ) || [];

      // Delete all metaobjects
      for (const id of [...postMetaobjectIds, ...listMetaobjectIds]) {
        await admin.graphql(
          `
          #graphql
          mutation metaobjectDelete($id: ID!) {
            metaobjectDelete(id: $id) {
              deletedId
              userErrors { field message }
            }
          }
        `,
          { variables: { id } },
        );
      }

      // Delete ONLY files created by this app (with instagram-post_ prefix in alt text)
      const filesQuery = await admin.graphql(`
        #graphql
        query {
          files(first: 250, query: "alt:instagram-post_") {
            edges { 
              node { 
                id 
                alt
              } 
            }
          }
        }
      `);
      const filesJson = await filesQuery.json();

      // Filter to ONLY files with alt text starting with "instagram-post_"
      const instagramFiles =
        filesJson.data?.files?.edges?.filter((edge: any) =>
          edge.node.alt?.startsWith("instagram-post_"),
        ) || [];

      const fileIds = instagramFiles.map((edge: any) => edge.node.id);

      if (fileIds.length > 0) {
        await admin.graphql(
          `
          #graphql
          mutation fileDelete($fileIds: [ID!]!) {
            fileDelete(fileIds: $fileIds) {
              deletedFileIds
              userErrors { field message }
            }
          }
        `,
          { variables: { fileIds } },
        );
      }

      const totalMetaobjects =
        postMetaobjectIds.length + listMetaobjectIds.length;
      console.log(
        `✓ Deleted ${totalMetaobjects} metaobjects and ${fileIds.length} files`,
      );

      return json({
        success: true,
        deletedMetaobjects: totalMetaobjects,
        deletedFiles: fileIds.length,
        message: `Deleted ${totalMetaobjects} metaobjects and ${fileIds.length} files`,
      });
    } catch (error) {
      console.error("Delete error:", error);
      return json(
        { success: false, message: "Delete failed. Please try again." },
        { status: 500 },
      );
    }
  }

  if (actionType === "disconnect") {
    try {
      // First delete all Instagram data
      // Query instagram_post metaobjects
      const postMetaobjectsQuery = await admin.graphql(`
        #graphql
        query {
          metaobjects(type: "instagram-post", first: 250) {
            edges { node { id } }
          }
        }
      `);
      const postMetaobjectsJson = await postMetaobjectsQuery.json();
      const postMetaobjectIds =
        postMetaobjectsJson.data?.metaobjects?.edges?.map(
          (e: any) => e.node.id,
        ) || [];

      // Query instagram_list metaobjects
      const listMetaobjectsQuery = await admin.graphql(`
        #graphql
        query {
          metaobjects(type: "instagram-list", first: 10) {
            edges { node { id } }
          }
        }
      `);
      const listMetaobjectsJson = await listMetaobjectsQuery.json();
      const listMetaobjectIds =
        listMetaobjectsJson.data?.metaobjects?.edges?.map(
          (e: any) => e.node.id,
        ) || [];

      // Delete all metaobjects
      for (const id of [...postMetaobjectIds, ...listMetaobjectIds]) {
        await admin.graphql(
          `
          #graphql
          mutation metaobjectDelete($id: ID!) {
            metaobjectDelete(id: $id) {
              deletedId
              userErrors { field message }
            }
          }
        `,
          { variables: { id } },
        );
      }

      // Delete ONLY files created by this app (with instagram-post_ prefix in alt text)
      const filesQuery = await admin.graphql(`
        #graphql
        query {
          files(first: 250, query: "alt:instagram-post_") {
            edges { 
              node { 
                id 
                alt
              } 
            }
          }
        }
      `);
      const filesJson = await filesQuery.json();

      // Filter to ONLY files with alt text starting with "instagram-post_"
      const instagramFiles =
        filesJson.data?.files?.edges?.filter((edge: any) =>
          edge.node.alt?.startsWith("instagram-post_"),
        ) || [];

      const fileIds = instagramFiles.map((edge: any) => edge.node.id);

      if (fileIds.length > 0) {
        await admin.graphql(
          `
          #graphql
          mutation fileDelete($fileIds: [ID!]!) {
            fileDelete(fileIds: $fileIds) {
              deletedFileIds
              userErrors { field message }
            }
          }
        `,
          { variables: { fileIds } },
        );
      }

      // Then remove the social account connection
      await prisma.socialAccount.delete({
        where: {
          shop_provider: {
            shop: session.shop,
            provider: "instagram",
          },
        },
      });

      const totalMetaobjects =
        postMetaobjectIds.length + listMetaobjectIds.length;
      console.log(
        `✓ Disconnected account and deleted ${totalMetaobjects} metaobjects and ${fileIds.length} files`,
      );

      return json({
        success: true,
        deletedMetaobjects: totalMetaobjects,
        deletedFiles: fileIds.length,
        message: `Disconnected and deleted ${totalMetaobjects} metaobjects and ${fileIds.length} files`,
      });
    } catch (error) {
      console.error("Disconnect error:", error);
      return json(
        { success: false, message: "Disconnect failed. Please try again." },
        { status: 500 },
      );
    }
  }

  return json({ success: false, message: "Invalid action" }, { status: 400 });
};

export default function Index() {
  const { shop, instagramAccount, syncStats, isConnected } =
    useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const fetcher = useFetcher();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>("");
  const [syncProgress, setSyncProgress] = useState(0);
  const [deleteMessage, setDeleteMessage] = useState<string>("");

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

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncStatus("Connecting to Instagram...");
    setSyncProgress(10);

    try {
      // Store the current counts before sync
      const beforeSync = {
        posts: syncStats.postsCount,
        files: syncStats.filesCount,
        metaobjects: syncStats.metaobjectsCount,
      };

      setSyncStatus("Fetching Instagram posts...");
      setSyncProgress(30);

      // Call the sync endpoint
      const response = await fetch("/api/instagram/staged-upload", {
        method: "GET",
      });

      if (response.ok) {
        setSyncStatus("Uploading media files to Shopify...");
        setSyncProgress(60);

        // Wait a bit for the sync to complete
        await new Promise((resolve) => setTimeout(resolve, 2000));

        setSyncStatus("Creating metaobjects...");
        setSyncProgress(80);

        await new Promise((resolve) => setTimeout(resolve, 1500));

        setSyncProgress(100);

        // Fetch updated counts
        try {
          const loaderResponse = await fetch(window.location.href);
          const html = await loaderResponse.text();

          // Show completion message
          const newPosts = syncStats.postsCount - beforeSync.posts;
          const newFiles = syncStats.filesCount - beforeSync.files;

          if (newPosts > 0 || newFiles > 0) {
            setSyncStatus(
              `✓ Sync completed! Added ${newPosts} posts and ${newFiles} files.`,
            );
          } else {
            setSyncStatus("✓ Sync completed! All posts are up to date.");
          }
        } catch {
          setSyncStatus("✓ Sync completed successfully!");
        }

        // Reload the page after showing summary
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        setSyncStatus("Sync failed. Please try again.");
        setSyncProgress(0);
        setTimeout(() => setIsSyncing(false), 2000);
      }
    } catch (error) {
      console.error("Sync error:", error);
      setSyncStatus("Sync failed. Please try again.");
      setSyncProgress(0);
      setTimeout(() => setIsSyncing(false), 2000);
    }
  };

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
    <Page title="Instagram Feed Manager">
      <Layout>
        {/* Delete Success Banner */}
        {deleteMessage && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setDeleteMessage("")}>
              <Text as="p" variant="bodyMd">
                {deleteMessage}
              </Text>
            </Banner>
          </Layout.Section>
        )}

        {/* Manual Sync Card */}
        {isConnected && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="200">
                    <Text as="h2" variant="headingMd">
                      Manual Sync
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Fetch the latest posts from your Instagram account
                    </Text>
                  </BlockStack>
                  <Button
                    variant="primary"
                    icon={RefreshIcon}
                    onClick={handleSync}
                    loading={isSyncing}
                    disabled={isActionRunning}
                  >
                    Sync Now
                  </Button>
                </InlineStack>

                {isSyncing && (
                  <>
                    <Divider />
                    <BlockStack gap="300">
                      <InlineStack gap="200" blockAlign="center">
                        <Spinner size="small" />
                        <Text as="p" variant="bodyMd">
                          {syncStatus}
                        </Text>
                      </InlineStack>
                      <ProgressBar progress={syncProgress} size="small" />
                    </BlockStack>
                  </>
                )}

                {!isSyncing && syncStats.lastSyncTime && (
                  <>
                    <Divider />
                    <InlineStack gap="200" blockAlign="center">
                      <Icon source={CalendarIcon} tone="subdued" />
                      <Text as="p" variant="bodySm" tone="subdued">
                        Last synced {formatDate(syncStats.lastSyncTime)}
                      </Text>
                    </InlineStack>
                  </>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Connection Status */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">
                  Account Connection
                </Text>
                {isConnected ? (
                  <Badge tone="success">Connected</Badge>
                ) : (
                  <Badge tone="attention">Not Connected</Badge>
                )}
              </InlineStack>

              <Divider />

              {isConnected && instagramAccount ? (
                <BlockStack gap="400">
                  <InlineStack gap="400" blockAlign="center">
                    {instagramAccount.profilePicture && (
                      <Thumbnail
                        source={instagramAccount.profilePicture}
                        alt={instagramAccount.username}
                        size="large"
                      />
                    )}
                    <BlockStack gap="200">
                      <InlineStack gap="200" blockAlign="center">
                        <Icon source={LogoInstagramIcon} />
                        <Text as="p" variant="headingMd">
                          @{instagramAccount.username}
                        </Text>
                      </InlineStack>
                      <Text as="p" variant="bodySm" tone="subdued">
                        User ID: {instagramAccount.userId}
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Connected {formatDate(instagramAccount.connectedAt)}
                      </Text>
                    </BlockStack>
                  </InlineStack>

                  <Divider />

                  <InlineStack gap="300" wrap={false}>
                    <Button
                      onClick={handleSwitchAccount}
                      disabled={isSyncing || isActionRunning}
                    >
                      Switch Account
                    </Button>
                    <Button
                      onClick={handleDeleteData}
                      tone="critical"
                      loading={
                        fetcher.state === "submitting" &&
                        fetcher.formData?.get("action") === "delete-data"
                      }
                      disabled={isSyncing || isActionRunning}
                    >
                      Delete Data
                    </Button>
                    <Button
                      onClick={handleDisconnect}
                      tone="critical"
                      loading={
                        fetcher.state === "submitting" &&
                        fetcher.formData?.get("action") === "disconnect"
                      }
                      disabled={isSyncing || isActionRunning}
                    >
                      Disconnect Account
                    </Button>
                  </InlineStack>
                </BlockStack>
              ) : (
                <BlockStack gap="400">
                  <Text as="p" tone="subdued">
                    Connect your Instagram Business account to start syncing
                    your posts to Shopify.
                  </Text>
                  <Box>
                    <Button
                      variant="primary"
                      icon={LogoInstagramIcon}
                      onClick={handleConnect}
                    >
                      Connect Instagram Account
                    </Button>
                  </Box>
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Sync Statistics */}
        {isConnected && (
          <>
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Sync Statistics
                  </Text>

                  <Divider />

                  <InlineStack gap="400" wrap={false}>
                    <Box width="100%">
                      <Card background="bg-surface-secondary">
                        <BlockStack gap="200">
                          <InlineStack gap="200" blockAlign="center">
                            <Icon source={LogoInstagramIcon} tone="info" />
                            <Text as="p" variant="headingSm">
                              Posts Synced
                            </Text>
                          </InlineStack>
                          <Text as="p" variant="heading2xl">
                            {syncStats.postsCount}
                          </Text>
                          <Link
                            url={`https://admin.shopify.com/store/${shop.replace(
                              ".myshopify.com",
                              "",
                            )}/content/metaobjects/instagram-post`}
                            target="_blank"
                            removeUnderline
                          >
                            <Text as="span" variant="bodySm" tone="magic">
                              View in Shopify →
                            </Text>
                          </Link>
                        </BlockStack>
                      </Card>
                    </Box>

                    <Box width="100%">
                      <Card background="bg-surface-secondary">
                        <BlockStack gap="200">
                          <InlineStack gap="200" blockAlign="center">
                            <Icon source={ImageIcon} tone="success" />
                            <Text as="p" variant="headingSm">
                              Files Created
                            </Text>
                          </InlineStack>
                          <Text as="p" variant="heading2xl">
                            {syncStats.filesCount}
                          </Text>
                          <Link
                            url={`https://admin.shopify.com/store/${shop.replace(
                              ".myshopify.com",
                              "",
                            )}/content/files?selectedView=all&media_type=IMAGE%2CVIDEO&query=instagram`}
                            target="_blank"
                            removeUnderline
                          >
                            <Text as="span" variant="bodySm" tone="magic">
                              View in Shopify →
                            </Text>
                          </Link>
                        </BlockStack>
                      </Card>
                    </Box>

                    <Box width="100%">
                      <Card background="bg-surface-secondary">
                        <BlockStack gap="200">
                          <InlineStack gap="200" blockAlign="center">
                            <Icon source={FileIcon} tone="warning" />
                            <Text as="p" variant="headingSm">
                              Metaobjects
                            </Text>
                          </InlineStack>
                          <Text as="p" variant="heading2xl">
                            {syncStats.metaobjectsCount}
                          </Text>
                          <Link
                            url={`https://admin.shopify.com/store/${shop.replace(
                              ".myshopify.com",
                              "",
                            )}/content/metaobjects`}
                            target="_blank"
                            removeUnderline
                          >
                            <Text as="span" variant="bodySm" tone="magic">
                              View in Shopify →
                            </Text>
                          </Link>
                        </BlockStack>
                      </Card>
                    </Box>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section>
              <Banner tone="info">
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd">
                    Your Instagram posts are automatically synced. Use the "Sync
                    Now" button to manually fetch the latest posts.
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Note: The sync process may take a few minutes depending on
                    the number of posts.
                  </Text>
                </BlockStack>
              </Banner>
            </Layout.Section>

            {/* Developer Guide */}
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Developer Guide: Using Instagram Data in Liquid
                  </Text>

                  <Divider />

                  <BlockStack gap="300">
                    <Text as="p" variant="bodyMd">
                      Use the synced Instagram posts in your theme with Liquid
                      code. Here are real examples from this app:
                    </Text>

                    {/* Minimal example: no divs/styling, just assign + loops */}
                    <BlockStack gap="200">
                      <Text as="p" variant="headingSm">
                        Minimal copy-paste example
                      </Text>
                      <Box
                        padding="400"
                        background="bg-surface-secondary"
                        borderRadius="200"
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
                          {`{% assign lists = metaobjects['instagram-list']['instagram-feed-list'] %}

{% for post in lists.posts.value %}
  {% for media in post.images.value %}
    {% if media.sources %}
      {{ media | video_tag }}
    {% else %}
      {{ media | image_url: width: 800 }}
    {% endif %}
  {% endfor %}
{% endfor %}`}
                        </pre>
                      </Box>
                    </BlockStack>

                    <BlockStack gap="200">
                      <Text as="p" variant="headingSm">
                        Basic Instagram Feed (from instagram-carousel.liquid)
                      </Text>
                      <Box
                        padding="400"
                        background="bg-surface-secondary"
                        borderRadius="200"
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
                          {`{% assign lists = metaobjects['instagram-list']['instagram-feed-list'] %}

<section class="instagram-feed">
  {% for post in lists.posts.value %}
    <div class="instagram-card">
      {% for media in post.images.value limit: 1 %}
        {% if media.sources %}
          {{ media | video_tag: autoplay: true, loop: true, muted: true }}
        {% else %}
          <img src="{{ media | image_url: width: 800, height: 1200, crop: 'center' }}"
               alt="Instagram Post">
        {% endif %}
      {% endfor %}
      
      <div class="overlay">
        <div class="stats">
          <span class="likes">{{ post.likes.value }} ❤️</span>
          <span class="comments">{{ post.comments.value }} 💬</span>
        </div>
      </div>
    </div>
  {% endfor %}
</section>

<footer>
  <h4>@{{ lists.username }}</h4>
</footer>`}
                        </pre>
                      </Box>
                    </BlockStack>

                    <BlockStack gap="200">
                      <Text as="p" variant="headingSm">
                        Carousel Album with Multiple Images
                      </Text>
                      <Box
                        padding="400"
                        background="bg-surface-secondary"
                        borderRadius="200"
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
                          {`{% assign lists = metaobjects['instagram-list']['instagram-feed-list'] %}

{% for post in lists.posts.value %}
  <div class="instagram-post">
    <!-- Loop through all images in a carousel post -->
    {% for media in post.images.value %}
      <div class="slide" data-slide="{{ forloop.index0 }}">
        {% if media.sources %}
          <video controls playsinline>
            {% for source in media.sources %}
              <source src="{{ source.url }}" type="{{ source.mime_type }}">
            {% endfor %}
          </video>
        {% else %}
          <img src="{{ media | image_url: width: 1200 }}"
               alt="Instagram post {{ forloop.index }}">
        {% endif %}
      </div>
    {% endfor %}
    
    <!-- Show indicators if multiple images -->
    {% if post.images.value.size > 1 %}
      <div class="indicators">
        {% for media in post.images.value %}
          <div class="dot" data-index="{{ forloop.index0 }}"></div>
        {% endfor %}
      </div>
    {% endif %}
  </div>
{% endfor %}`}
                        </pre>
                      </Box>
                    </BlockStack>

                    <BlockStack gap="200">
                      <Text as="p" variant="headingSm">
                        Display Post Details with Caption
                      </Text>
                      <Box
                        padding="400"
                        background="bg-surface-secondary"
                        borderRadius="200"
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
                          {`{% assign lists = metaobjects['instagram-list']['instagram-feed-list'] %}

{% for post in lists.posts.value %}
  <article class="instagram-post-detail">
    <div class="post-header">
      <strong>@{{ lists.username }}</strong>
    </div>
    
    <div class="post-stats">
      <span>❤️ {{ post.likes.value }} likes</span>
      <span>💬 {{ post.comments.value }} comments</span>
    </div>
    
    <div class="post-caption">
      <strong>@{{ lists.username }}</strong> {{ post.caption.value }}
    </div>
    
    <div class="post-date">
      {{ post.timestamp.value | date: "%B %d, %Y" }}
    </div>
  </article>
{% endfor %}`}
                        </pre>
                      </Box>
                    </BlockStack>

                    <BlockStack gap="200">
                      <Text as="p" variant="headingSm">
                        Available Metaobject Fields
                      </Text>
                      <Box
                        padding="400"
                        background="bg-surface-secondary"
                        borderRadius="200"
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
                          {`instagram-list metaobject:
  • lists.username          - Instagram username
  • lists.posts.value       - Array of post references

instagram-post metaobject (each post):
  • post.images.value       - Array of media (images/videos)
  • post.caption.value      - Post caption text
  • post.likes.value        - Number of likes
  • post.comments.value     - Number of comments
  • post.timestamp.value    - Post timestamp
  • post.permalink.value    - Link to Instagram post

Each media item:
  • media.sources           - Video sources (if video)
  • media | image_url       - Image URL filter
  • media | video_tag       - Video tag filter`}
                        </pre>
                      </Box>
                    </BlockStack>

                    <Text as="p" variant="bodySm" tone="subdued">
                      💡 Tip: Use the "View in Shopify" links above to see your
                      metaobject IDs and explore all available fields.
                    </Text>

                    <Text as="p" variant="bodySm" tone="subdued">
                      📦 Check the theme extension at{" "}
                      <code>
                        extensions/instagram-feed/blocks/instagram-carousel.liquid
                      </code>{" "}
                      for a complete working example with modal, carousel
                      navigation, and animations.
                    </Text>
                  </BlockStack>
                </BlockStack>
              </Card>
            </Layout.Section>
          </>
        )}
      </Layout>
    </Page>
  );
}
