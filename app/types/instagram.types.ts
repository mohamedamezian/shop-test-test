/**
 * Type definitions for Instagram integration
 */

export interface SyncStats {
  lastSyncTime: string | null;
  postsCount: number;
  filesCount: number;
  metaobjectsCount: number;
}

export interface InstagramAccount {
  username: string;
  userId: string;
  profilePicture?: string;
  connectedAt: string;
}

export interface LoaderData {
  shop: string;
  instagramAccount: InstagramAccount | null;
  syncStats: SyncStats;
  isConnected: boolean;
  themePages: Array<{ label: string; value: string }>;
}

export interface ActionResponse {
  success: boolean;
  message: string;
  status?: number;
  deletedMetaobjects?: number;
  deletedFiles?: number;
  redirectUrl?: string;
}
