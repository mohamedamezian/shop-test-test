# Comprehensive Logging Implementation

## What Was Added

I've implemented detailed JSON logging for the entire Instagram sync process. Every operation (file uploads, metaobject creation/updates, API calls) is now tracked with full request/response data.

## Log Files

- **Location**: `logs/instagram-sync-{timestamp}.json`
- **Format**: Structured JSON with chronological operations
- **Auto-generated**: Created on every sync run
- **Git-ignored**: Won't clutter your repository

## What's Logged

### 1. **Existing Posts Detection**

- Query results from Shopify files API
- Alt text values found
- Extracted post IDs
- **Helps diagnose**: Why posts are/aren't detected as existing

### 2. **Instagram API Fetch**

- Posts fetched from Instagram
- Post metadata (type, likes, comments, children)
- **Helps diagnose**: What data comes from Instagram

### 3. **Post Processing Decisions**

- For each post: create vs update decision
- The reason for the decision
- File count and media type
- **Helps diagnose**: Why posts are re-uploaded or skipped

### 4. **File Upload Operations**

- Staged upload creation (videos)
- File upload submission
- File creation in Shopify
- Full GraphQL responses
- **Helps diagnose**: Upload failures, duplicate files

### 5. **Metaobject Operations**

- Post metaobject upserts
- List metaobject upsert
- Full input/output data
- UserErrors if any
- **Helps diagnose**: Field mismatches, validation errors, publish status

## Viewing Logs

### Quick Commands

```bash
# View summary of latest sync
./view-logs.sh summary

# Show only errors
./view-logs.sh errors

# Show all file operations
./view-logs.sh files

# Show metaobject operations
./view-logs.sh metaobjects

# See what posts were detected as existing
./view-logs.sh existing

# See create vs update decisions
./view-logs.sh processing

# Full log dump
./view-logs.sh all

# List available logs
./view-logs.sh list
```

### Manual jq Queries

```bash
# Find all failed operations
jq '.operations[] | select(.success == false)' logs/instagram-sync-*.json

# Check why a specific post was duplicated
jq '.operations[] | select(.postId == "YOUR_POST_ID")' logs/instagram-sync-*.json

# See all GraphQL userErrors
jq '.operations[] | select(.userErrors | length > 0) | {operation, userErrors}' logs/instagram-sync-*.json

# Check file IDs for a post
jq '.operations[] | select(.operation == "metaobjectUpsert_post") | {postId, fileIds}' logs/instagram-sync-*.json

# See publish status of list metaobject
jq '.operations[] | select(.operation == "metaobjectUpsert_list") | .capabilities' logs/instagram-sync-*.json
```

## How to Debug Issues

### Issue: Files are being duplicated

1. Run sync, then check:

```bash
./view-logs.sh existing
```

2. Look at `extractedKeysSample` - are the post IDs correct?
3. Check:

```bash
./view-logs.sh processing
```

4. Look for posts with `action: "create"` - should they be `"update"`?
5. Compare the `reason` field to understand why

### Issue: Metaobject not updating

1. Check:

```bash
./view-logs.sh metaobjects
```

2. Look for the specific post's metaobject operation
3. Check `success` field and `userErrors`
4. Verify `fileIds` array is not empty
5. Check `metaobjectId` to confirm which object was touched

### Issue: List is in draft

1. Check:

```bash
./view-logs.sh metaobjects | jq 'select(.operation == "metaobjectUpsert_list")'
```

2. Look at the `capabilities` field in the response
3. Check if `capabilities.publishable.status` is set in input vs output

## Example Log Structure

```json
{
  "timestamp": "2025-11-18T16:30:00.000Z",
  "shop": "near-native-apps-2.myshopify.com",
  "operations": [
    {
      "timestamp": "2025-11-18T16:30:01.234Z",
      "operation": "getExistingPosts",
      "filesFound": 12,
      "sampleAlts": [...],
      "extractedKeysCount": 5,
      "extractedKeysSample": ["123456", "789012"]
    },
    {
      "timestamp": "2025-11-18T16:30:02.456Z",
      "operation": "postProcessing",
      "postId": "123456",
      "action": "update",
      "reason": "existingKeys.has(post.id) = true",
      "fileIdsLength": 0
    },
    {
      "timestamp": "2025-11-18T16:30:03.789Z",
      "operation": "fileCreate",
      "input": {...},
      "response": {...},
      "success": true,
      "fileIds": ["gid://shopify/MediaImage/..."]
    }
  ],
  "summary": {
    "postsProcessed": 5,
    "postsUploaded": 3,
    "existingPostsCount": 2,
    "operationsCount": 42,
    "fileUploads": 8,
    "metaobjectUpserts": 4,
    "errors": 0
  }
}
```

## Next Steps

1. **Run a sync** - Visit your Instagram sync endpoint
2. **Check the logs**:
   ```bash
   ./view-logs.sh summary
   ```
3. **Investigate issues**:
   ```bash
   ./view-logs.sh errors
   ./view-logs.sh processing
   ```
4. **Share findings** - The log files contain everything needed to diagnose problems

The logs will reveal:

- Why `existingKeys` only contains videos (check `getExistingPosts` operation)
- Why files are duplicated (check `postProcessing` actions)
- Why updates aren't happening (check `fileIdsLength` in update branch)
- Any GraphQL errors or validation issues
