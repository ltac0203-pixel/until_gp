import React from 'react';
import {
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Text,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Attachment } from '../types';
import { MediaStorageService } from '../services/mediaStorage';

interface MediaPreviewProps {
  attachments: Attachment[];
  onRemoveAttachment: (attachmentId: string) => void;
}

export const MediaPreview: React.FC<MediaPreviewProps> = ({
  attachments,
  onRemoveAttachment,
}) => {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {attachments.map((attachment) => (
          <View key={attachment.id} style={styles.previewItem}>
            <Image
              source={{ uri: attachment.uri }}
              style={styles.previewImage}
              resizeMode="cover"
            />
            {attachment.type === 'video' && (
              <View style={styles.videoIndicator}>
                <Icon name="play-circle" size={24} color="white" />
              </View>
            )}
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => onRemoveAttachment(attachment.id)}
            >
              <Icon name="close-circle" size={20} color="white" />
            </TouchableOpacity>
            {attachment.fileSize && (
              <View style={styles.sizeLabel}>
                <Text style={styles.sizeText}>
                  {MediaStorageService.formatFileSize(attachment.fileSize)}
                </Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  scrollContent: {
    paddingHorizontal: 12,
  },
  previewItem: {
    position: 'relative',
    marginRight: 8,
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
  },
  videoIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -12 }, { translateY: -12 }],
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
  },
  sizeLabel: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sizeText: {
    color: 'white',
    fontSize: 10,
    textAlign: 'center',
  },
});