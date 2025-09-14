import React from 'react';
import {
  TouchableOpacity,
  Alert,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import { Attachment } from '../types';

interface MediaPickerProps {
  onMediaSelected: (attachments: Attachment[]) => void;
  color?: string;
}

export const MediaPicker: React.FC<MediaPickerProps> = ({ 
  onMediaSelected, 
  color = '#007AFF' 
}) => {
  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
      Alert.alert(
        '権限が必要です',
        '写真と動画を使用するために、カメラとメディアライブラリへのアクセスを許可してください。'
      );
      return false;
    }
    return true;
  };

  const launchCamera = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.8,
      videoMaxDuration: 60,
    });

    if (!result.canceled && result.assets) {
      const attachments = result.assets.map((asset, index) => ({
        id: `${Date.now()}-${index}`,
        uri: asset.uri,
        type: asset.type === 'video' ? 'video' : 'image' as 'image' | 'video',
        fileName: asset.fileName || `media_${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
        fileSize: asset.fileSize,
        width: asset.width,
        height: asset.height,
        duration: asset.duration || undefined,
      }));
      onMediaSelected(attachments);
    }
  };

  const launchImageLibrary = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      allowsMultipleSelection: true,
      quality: 0.8,
      videoMaxDuration: 60,
    });

    if (!result.canceled && result.assets) {
      const attachments = result.assets.map((asset, index) => ({
        id: `${Date.now()}-${index}`,
        uri: asset.uri,
        type: asset.type === 'video' ? 'video' : 'image' as 'image' | 'video',
        fileName: asset.fileName || `media_${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
        fileSize: asset.fileSize,
        width: asset.width,
        height: asset.height,
        duration: asset.duration || undefined,
      }));
      onMediaSelected(attachments);
    }
  };

  const showMediaOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['キャンセル', 'カメラ', 'フォトライブラリ'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            launchCamera();
          } else if (buttonIndex === 2) {
            launchImageLibrary();
          }
        }
      );
    } else {
      Alert.alert(
        'メディアを選択',
        '',
        [
          { text: 'キャンセル', style: 'cancel' },
          { text: 'カメラ', onPress: launchCamera },
          { text: 'フォトライブラリ', onPress: launchImageLibrary },
        ],
        { cancelable: true }
      );
    }
  };

  return (
    <TouchableOpacity
      onPress={showMediaOptions}
      style={{ padding: 8 }}
    >
      <Icon name="attach" size={24} color={color} />
    </TouchableOpacity>
  );
};