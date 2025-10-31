// app/routes/components/PostDisplay.tsx
import { Card, Text, Image, BlockStack, InlineGrid, Button } from '@shopify/polaris'
import { EditIcon } from '@shopify/polaris-icons'
import type { InstagramPost } from '../api.instagram.post'

interface PostDisplayProps {
  post: InstagramPost
}

export function PostDisplay({ post }: PostDisplayProps) {
  // Helper: render a single image card
  const renderImage = (
    imageUrl: string,
    mediaType: string,
    caption?: string,
    username?: string,
    key?: string | number
  ) => (
    <Card key={key ?? post.id} roundedAbove="sm">
      <BlockStack gap="400">
        <BlockStack gap="200">
          <Text as="h2" variant="headingSm">
            Instagram Post #{post.id}
          </Text>
          <Image source={imageUrl} alt={caption || 'Instagram image'} />
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
            Caption: {caption || '—'}
            <br />
            Username: {username || '—'}
          </Text>
        </BlockStack>
      </BlockStack>
    </Card>
  )

  // Render: single image or carousel
  if (post.media_type === 'CAROUSEL_ALBUM' && post.children?.data) {
    return (
      <>
        {post.children.data.map((child, index) =>
          renderImage(
            child.media_url,
            child.media_type,
            post.caption,
            post.username,
            `${post.id}-${index}`
          )
        )}
      </>
    )
  }

  // Single image
  return renderImage(post.media_url, post.media_type, post.caption, post.username)
}
