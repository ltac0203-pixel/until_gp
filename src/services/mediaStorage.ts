import * as FileSystem from 'expo-file-system';
import { Attachment } from '../types';

const MEDIA_DIRECTORY = FileSystem.documentDirectory + 'slowmail_media/';

export const MediaStorageService = {
  async ensureDirectoryExists(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(MEDIA_DIRECTORY);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(MEDIA_DIRECTORY, { intermediates: true });
    }
  },

  async saveMediaFile(uri: string, fileName: string): Promise<string> {
    try {
      await this.ensureDirectoryExists();
      const newUri = MEDIA_DIRECTORY + fileName;
      
      // Copy the file to our app's document directory
      await FileSystem.copyAsync({
        from: uri,
        to: newUri,
      });
      
      return newUri;
    } catch (error) {
      console.error('Failed to save media file:', error);
      // Return original URI if save fails
      return uri;
    }
  },

  async deleteMediaFile(uri: string): Promise<void> {
    try {
      // Only delete if it's in our media directory
      if (uri.startsWith(MEDIA_DIRECTORY)) {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(uri);
        }
      }
    } catch (error) {
      console.error('Failed to delete media file:', error);
    }
  },

  async saveAttachments(attachments: Attachment[]): Promise<Attachment[]> {
    const savedAttachments: Attachment[] = [];
    
    for (const attachment of attachments) {
      try {
        const fileName = `${attachment.id}_${attachment.fileName || 'media'}`;
        const savedUri = await this.saveMediaFile(attachment.uri, fileName);
        
        savedAttachments.push({
          ...attachment,
          uri: savedUri,
        });
      } catch (error) {
        console.error('Failed to save attachment:', error);
        // Keep original attachment if save fails
        savedAttachments.push(attachment);
      }
    }
    
    return savedAttachments;
  },

  async deleteAttachments(attachments: Attachment[]): Promise<void> {
    for (const attachment of attachments) {
      await this.deleteMediaFile(attachment.uri);
    }
  },

  async getFileSize(uri: string): Promise<number | undefined> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (fileInfo.exists && 'size' in fileInfo) {
        return fileInfo.size;
      }
    } catch (error) {
      console.error('Failed to get file size:', error);
    }
    return undefined;
  },

  async createThumbnail(videoUri: string): Promise<string | undefined> {
    // For now, we'll return undefined. 
    // In a production app, you might want to use a library like expo-av 
    // to generate video thumbnails
    return undefined;
  },

  async cleanupOldMedia(): Promise<void> {
    try {
      await this.ensureDirectoryExists();
      const files = await FileSystem.readDirectoryAsync(MEDIA_DIRECTORY);
      const now = Date.now();
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
      
      for (const file of files) {
        const fileUri = MEDIA_DIRECTORY + file;
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        
        if (fileInfo.exists && 'modificationTime' in fileInfo) {
          const modTime = fileInfo.modificationTime * 1000;
          if (modTime < thirtyDaysAgo) {
            await FileSystem.deleteAsync(fileUri);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old media:', error);
    }
  },

  formatFileSize(bytes?: number): string {
    if (!bytes) return '';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  },
};