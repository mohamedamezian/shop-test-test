// app/routes/components/PostDisplay.tsx
import {
  Card,
  Text,
  Image,
  BlockStack,
  InlineGrid,
  Button,
  VideoThumbnail,
} from "@shopify/polaris";
import { EditIcon } from "@shopify/polaris-icons";
import type { InstagramPost } from "../api.instagram.post";

interface PostDisplayProps {
  post: InstagramPost;
}

export function PostDisplay({ post }: PostDisplayProps) {
  // Helper: render a single media card (image or video)
  const renderMedia = (
    mediaUrl: string,
    mediaType: string,
    caption?: string,
    username?: string,
    key?: string | number,
    thumbnailUrl?: string,
  ) => (
    <Card key={key ?? post.id} roundedAbove="sm">
      <BlockStack gap="400">
        <BlockStack gap="200">
          <Text as="h2" variant="headingSm">
            Instagram Post #{post.id}
          </Text>
          {mediaType === "VIDEO" ? (
            <VideoThumbnail
              thumbnailUrl={thumbnailUrl || mediaUrl}
              onClick={() => window.open(mediaUrl, "_blank")}
            />
          ) : (
            <Image source={mediaUrl} alt={caption || "Instagram image"} />
          )}
        </BlockStack>

        <BlockStack gap="200">
          <InlineGrid columns="1fr auto">
            <Text as="h3" variant="headingSm" fontWeight="medium">
              Post Information
            </Text>
            <Button
              icon={EditIcon}
              variant="tertiary"
              onClick={() => {}}
              accessibilityLabel="Edit"
            />
          </InlineGrid>
          <Text as="p" variant="bodyMd">
            Post type: {mediaType}
            <br />
            Caption: {caption || "—"}
            <br />
            Username: {username || "—"}
          </Text>
        </BlockStack>
      </BlockStack>
    </Card>
  );

  // Render: single image/video or carousel (with images/videos)
  if (post.media_type === "CAROUSEL_ALBUM" && post.children?.data) {
    return (
      <>
        {post.children.data.map((child, index) =>
          renderMedia(
            child.media_url,
            child.media_type,
            post.caption,
            post.username,
            `${post.id}-${index}`,
            child.thumbnail_url,
          ),
        )}
      </>
    );
  }
  // Single video
  if (post.media_type === "VIDEO") {
    return renderMedia(
      post.media_url,
      post.media_type,
      post.caption,
      post.username,
      post.id,
      post.thumbnail_url,
    );
  }
  // Single image
  return renderMedia(
    post.media_url,
    post.media_type,
    post.caption,
    post.username,
    post.id,
  );
}
