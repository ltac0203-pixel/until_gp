import { supabase } from '../utils/supabase';
import { authService } from './authService';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';

export interface MediaUploadResult {
  filePath: string;
  thumbnailPath?: string;
  fileSize: number;
  fileType: string;
  metadata?: any;
}

export interface MediaUploadOptions {
  messageId: string;
  localUri: string;
  type: 'image' | 'video';
  quality?: number; // 0-1 for compression
  maxWidth?: number;
  maxHeight?: number;
}

class SupabaseMediaStorage {
  private readonly BUCKET_NAME = 'media';
  private readonly THUMBNAIL_BUCKET = 'thumbnails';

  /**
   * Initialize storage buckets (call this during app setup)
   */
  async initializeBuckets(): Promise<void> {
    try {
      // Check if buckets exist, create if they don't
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketNames = buckets?.map(b => b.name) || [];

      if (!bucketNames.includes(this.BUCKET_NAME)) {
        await supabase.storage.createBucket(this.BUCKET_NAME, {
          public: false, // Private bucket with RLS
          allowedMimeTypes: ['image/*', 'video/*'],
          fileSizeLimit: 50 * 1024 * 1024, // 50MB limit
        });
      }

      if (!bucketNames.includes(this.THUMBNAIL_BUCKET)) {
        await supabase.storage.createBucket(this.THUMBNAIL_BUCKET, {
          public: false,
          allowedMimeTypes: ['image/*'],
          fileSizeLimit: 5 * 1024 * 1024, // 5MB limit for thumbnails
        });
      }
    } catch (error) {
      console.error('Error initializing storage buckets:', error);
    }
  }

  /**
   * Upload media file and create thumbnail
   */
  async uploadMedia(options: MediaUploadOptions): Promise<MediaUploadResult | null> {
    try {
      const currentUser = await authService.getCurrentChatUser();
      if (!currentUser) {
        throw new Error('User must be authenticated to upload media');
      }

      // Read file as base64
      const fileBase64 = await FileSystem.readAsStringAsync(options.localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(options.localUri);
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }

      // Generate unique file path
      const fileExtension = this.getFileExtension(options.localUri);
      const fileName = `${currentUser.id}/${options.messageId}/${Date.now()}.${fileExtension}`;

      // Compress and process image if needed
      let processedBase64 = fileBase64;
      let metadata: any = {};

      if (options.type === 'image') {
        const processed = await this.processImage(
          options.localUri,
          options.quality || 0.8,
          options.maxWidth || 1920,
          options.maxHeight || 1080
        );
        processedBase64 = processed.base64;
        metadata = processed.metadata;
      }

      // Upload main file
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(this.BUCKET_NAME)
        .upload(fileName, decode(processedBase64), {
          contentType: this.getMimeType(fileExtension),
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Create thumbnail for images and videos
      let thumbnailPath: string | undefined;
      if (options.type === 'image') {
        thumbnailPath = await this.createImageThumbnail(options.localUri, fileName);
      } else if (options.type === 'video') {
        thumbnailPath = await this.createVideoThumbnail(options.localUri, fileName);
      }

      // Save attachment metadata to database
      const { error: dbError } = await supabase
        .from('attachments')
        .insert({
          message_id: options.messageId,
          file_path: uploadData.path,
          file_type: this.getMimeType(fileExtension),
          file_size: fileInfo.size || 0,
          thumbnail_path: thumbnailPath,
          metadata,
        });

      if (dbError) {
        console.error('Error saving attachment metadata:', dbError);
        // Clean up uploaded file if database save fails
        await this.deleteFile(uploadData.path);
        throw dbError;
      }

      return {
        filePath: uploadData.path,
        thumbnailPath,
        fileSize: fileInfo.size || 0,
        fileType: this.getMimeType(fileExtension),
        metadata,
      };
    } catch (error) {
      console.error('Error uploading media:', error);
      return null;
    }
  }

  /**
   * Get signed URL for media file
   */
  async getMediaUrl(filePath: string, expiresIn: number = 3600): Promise<string | null> {
    try {
      const { data, error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .createSignedUrl(filePath, expiresIn);

      if (error) {
        console.error('Error creating signed URL:', error);
        return null;
      }

      return data.signedUrl;
    } catch (error) {
      console.error('Error getting media URL:', error);
      return null;
    }
  }

  /**
   * Get signed URL for thumbnail
   */
  async getThumbnailUrl(thumbnailPath: string, expiresIn: number = 3600): Promise<string | null> {
    try {
      const { data, error } = await supabase.storage
        .from(this.THUMBNAIL_BUCKET)
        .createSignedUrl(thumbnailPath, expiresIn);

      if (error) {
        console.error('Error creating thumbnail signed URL:', error);
        return null;
      }

      return data.signedUrl;
    } catch (error) {
      console.error('Error getting thumbnail URL:', error);
      return null;
    }
  }

  /**
   * Download media file to local cache
   */
  async downloadMedia(filePath: string): Promise<string | null> {
    try {
      // Check if file is already cached
      const cacheDir = `${FileSystem.cacheDirectory}media/`;
      const localFileName = filePath.replace(/\//g, '_');
      const localPath = `${cacheDir}${localFileName}`;

      // Ensure cache directory exists
      const dirInfo = await FileSystem.getInfoAsync(cacheDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
      }

      // Check if file already exists locally
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (fileInfo.exists) {
        return localPath;
      }

      // Get signed URL and download
      const signedUrl = await this.getMediaUrl(filePath);
      if (!signedUrl) {
        return null;
      }

      const downloadResult = await FileSystem.downloadAsync(signedUrl, localPath);

      if (downloadResult.status === 200) {
        return downloadResult.uri;
      }

      return null;
    } catch (error) {
      console.error('Error downloading media:', error);
      return null;
    }
  }

  /**
   * Delete media file and its thumbnail
   */
  async deleteMedia(filePath: string, thumbnailPath?: string): Promise<boolean> {
    try {
      // Delete main file
      const { error: fileError } = await supabase.storage
        .from(this.BUCKET_NAME)
        .remove([filePath]);

      if (fileError) {
        console.error('Error deleting file:', fileError);
      }

      // Delete thumbnail if exists
      if (thumbnailPath) {
        const { error: thumbError } = await supabase.storage
          .from(this.THUMBNAIL_BUCKET)
          .remove([thumbnailPath]);

        if (thumbError) {
          console.error('Error deleting thumbnail:', thumbError);
        }
      }

      return !fileError;
    } catch (error) {
      console.error('Error deleting media:', error);
      return false;
    }
  }

  /**
   * Clean up expired group media
   */
  async cleanupExpiredGroupMedia(groupId: string): Promise<void> {
    try {
      // First get all message IDs for the group
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('id')
        .eq('group_id', groupId);

      if (messagesError) {
        console.error('Error getting group messages:', messagesError);
        return;
      }

      if (!messages || messages.length === 0) {
        return; // No messages, no attachments to clean up
      }

      const messageIds = messages.map(msg => msg.id);

      // Get all attachments for the group's messages
      const { data: attachments, error } = await supabase
        .from('attachments')
        .select('file_path, thumbnail_path')
        .in('message_id', messageIds);

      if (error) {
        console.error('Error getting group attachments:', error);
        return;
      }

      // Delete all files
      for (const attachment of attachments || []) {
        await this.deleteMedia(attachment.file_path, attachment.thumbnail_path);
      }
    } catch (error) {
      console.error('Error cleaning up group media:', error);
    }
  }

  /**
   * Get total storage usage for user
   */
  async getUserStorageUsage(): Promise<number> {
    try {
      const currentUser = await authService.getCurrentChatUser();
      if (!currentUser) {
        return 0;
      }

      // List all files for the user
      const { data: files, error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .list(currentUser.id, {
          limit: 1000,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (error) {
        console.error('Error getting storage usage:', error);
        return 0;
      }

      return (files || []).reduce((total, file) => total + (file.metadata?.size || 0), 0);
    } catch (error) {
      console.error('Error calculating storage usage:', error);
      return 0;
    }
  }

  // Private helper methods

  private async processImage(
    localUri: string,
    quality: number,
    maxWidth: number,
    maxHeight: number
  ): Promise<{ base64: string; metadata: any }> {
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        localUri,
        [{ resize: { width: maxWidth, height: maxHeight } }],
        {
          compress: quality,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      return {
        base64: manipResult.base64!,
        metadata: {
          width: manipResult.width,
          height: manipResult.height,
          originalUri: localUri,
        },
      };
    } catch (error) {
      console.error('Error processing image:', error);
      // Fallback to original
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return { base64, metadata: { originalUri: localUri } };
    }
  }

  private async createImageThumbnail(originalUri: string, fileName: string): Promise<string | undefined> {
    try {
      // Create smaller thumbnail
      const thumbResult = await ImageManipulator.manipulateAsync(
        originalUri,
        [{ resize: { width: 200, height: 200 } }],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      const thumbFileName = `thumb_${fileName}`;

      const { data, error } = await supabase.storage
        .from(this.THUMBNAIL_BUCKET)
        .upload(thumbFileName, decode(thumbResult.base64!), {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (error) {
        console.error('Error uploading thumbnail:', error);
        return undefined;
      }

      return data.path;
    } catch (error) {
      console.error('Error creating image thumbnail:', error);
      return undefined;
    }
  }

  private async createVideoThumbnail(videoUri: string, fileName: string): Promise<string | undefined> {
    try {
      // For video thumbnails, we'd need to extract a frame
      // This is more complex and might require additional native modules
      // For now, return undefined (no thumbnail for videos)
      return undefined;
    } catch (error) {
      console.error('Error creating video thumbnail:', error);
      return undefined;
    }
  }

  private getFileExtension(uri: string): string {
    const match = uri.match(/\.([^.]+)$/);
    return match ? match[1].toLowerCase() : 'jpg';
  }

  private getMimeType(extension: string): string {
    const mimeTypes: { [key: string]: string } = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
      mkv: 'video/x-matroska',
    };

    return mimeTypes[extension] || 'application/octet-stream';
  }

  private async deleteFile(filePath: string): Promise<void> {
    try {
      await supabase.storage.from(this.BUCKET_NAME).remove([filePath]);
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  }
}

// Export singleton instance
export const supabaseMediaStorage = new SupabaseMediaStorage();