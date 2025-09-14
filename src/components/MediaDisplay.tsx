import React, { useState } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Text,
  Modal,
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import BootstrapIcon from 'react-native-bootstrap-icons';
import { Attachment } from '../types';
import { MediaStorageService } from '../services/mediaStorage';

interface MediaDisplayProps {
  attachments: Attachment[];
  isOwnMessage?: boolean;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const MediaDisplay: React.FC<MediaDisplayProps> = ({ 
  attachments, 
  isOwnMessage = false 
}) => {
  const [selectedMedia, setSelectedMedia] = useState<Attachment | null>(null);
  const [videoStatus, setVideoStatus] = useState<any>({});
  const [imageLoading, setImageLoading] = useState<{[key: string]: boolean}>({});

  const renderThumbnail = (attachment: Attachment, index: number) => {
    const isVideo = attachment.type === 'video';
    
    return (
      <TouchableOpacity
        key={attachment.id}
        style={[
          styles.thumbnailContainer,
          index > 0 && styles.thumbnailMargin,
        ]}
        onPress={() => setSelectedMedia(attachment)}
      >
        {isVideo ? (
          <View style={styles.videoThumbnail}>
            <Video
              source={{ uri: attachment.uri }}
              style={styles.thumbnail}
              shouldPlay={false}
              isLooping={false}
              isMuted={true}
              resizeMode={ResizeMode.COVER}
            />
            <View style={styles.playButtonOverlay}>
              <BootstrapIcon name="play-circle" size={40} color="white" />
            </View>
            {attachment.duration && (
              <View style={styles.durationBadge}>
                <Text style={styles.durationText}>
                  {formatDuration(attachment.duration)}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View>
            {imageLoading[attachment.id] && (
              <View style={[styles.thumbnail, styles.loadingContainer]}>
                <ActivityIndicator size="small" color="#999" />
              </View>
            )}
            <Image
              source={{ uri: attachment.uri }}
              style={styles.thumbnail}
              resizeMode="cover"
              onLoadStart={() => setImageLoading(prev => ({ ...prev, [attachment.id]: true }))}
              onLoadEnd={() => setImageLoading(prev => ({ ...prev, [attachment.id]: false }))}
            />
          </View>
        )}
        {attachment.fileSize && (
          <Text style={styles.fileSizeText}>
            {MediaStorageService.formatFileSize(attachment.fileSize)}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderFullScreenMedia = () => {
    if (!selectedMedia) return null;

    return (
      <Modal
        visible={!!selectedMedia}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedMedia(null)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setSelectedMedia(null)}
          >
            <BootstrapIcon name="x-circle" size={36} color="white" />
          </TouchableOpacity>

          <ScrollView
            contentContainerStyle={styles.modalContent}
            maximumZoomScale={3}
            minimumZoomScale={1}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            {selectedMedia.type === 'video' ? (
              <Video
                source={{ uri: selectedMedia.uri }}
                style={styles.fullScreenMedia}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={true}
                isLooping={false}
                onPlaybackStatusUpdate={status => setVideoStatus(status)}
              />
            ) : (
              <Image
                source={{ uri: selectedMedia.uri }}
                style={styles.fullScreenMedia}
                resizeMode="contain"
              />
            )}
          </ScrollView>

          {selectedMedia.fileName && (
            <View style={styles.mediaInfo}>
              <Text style={styles.mediaInfoText}>{selectedMedia.fileName}</Text>
              {selectedMedia.fileSize && (
                <Text style={styles.mediaInfoText}>
                  {MediaStorageService.formatFileSize(selectedMedia.fileSize)}
                </Text>
              )}
            </View>
          )}
        </View>
      </Modal>
    );
  };

  if (!attachments || attachments.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.thumbnailsWrapper}>
        {attachments.map((attachment, index) => renderThumbnail(attachment, index))}
      </View>
      {renderFullScreenMedia()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  thumbnailsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  thumbnailContainer: {
    position: 'relative',
  },
  thumbnailMargin: {
    marginLeft: 8,
  },
  thumbnail: {
    width: 150,
    height: 150,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  videoThumbnail: {
    position: 'relative',
  },
  playButtonOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: 'white',
    fontSize: 12,
  },
  fileSizeText: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  fullScreenMedia: {
    width: screenWidth,
    height: screenHeight * 0.8,
  },
  mediaInfo: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
    borderRadius: 8,
  },
  mediaInfoText: {
    color: 'white',
    fontSize: 14,
    marginVertical: 2,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});