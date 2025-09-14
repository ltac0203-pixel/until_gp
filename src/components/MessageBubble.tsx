import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Message, MessageStatus } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themes';
import { MediaDisplay } from './MediaDisplay';

interface MessageBubbleProps {
  message: Message;
  onReactionPress?: (message: Message) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onReactionPress,
}) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const formatTime = (date: Date) => {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status?: MessageStatus) => {
    switch (status) {
      case 'pending': return '⏱';
      case 'sending': return '↗️';
      case 'sent': return '✓';
      case 'delivered': return '✓✓';
      case 'read': return '👁';
      case 'failed': return '❌';
      default: return '';
    }
  };

  const getStatusColor = (status?: MessageStatus) => {
    switch (status) {
      case 'pending': return colors.statusPending;
      case 'sending': return colors.textSecondary;
      case 'sent': return colors.statusSent;
      case 'delivered': return colors.statusDelivered;
      case 'read': return colors.statusRead;
      case 'failed': return colors.statusFailed;
      default: return colors.textSecondary;
    }
  };

  return (
    <View style={[
      styles.messageContainer,
      message.isOwnMessage ? styles.ownMessage : styles.otherMessage
    ]}>
      {!message.isOwnMessage && (
        <Text style={[styles.senderName, { color: colors.textSecondary }]}>
          {message.sender}
        </Text>
      )}
      <View style={[
        styles.bubble,
        {
          backgroundColor: message.isOwnMessage
            ? colors.messageBubbleOwn
            : colors.messageBubbleOther
        },
        message.status === 'pending' && styles.pendingBubble,
      ]}>
        {message.text ? (
          <Text style={[
            styles.messageText,
            {
              color: message.isOwnMessage
                ? colors.messageTextOwn
                : colors.messageTextOther
            },
            message.status === 'pending' && styles.pendingText,
          ]}>
            {message.text}
          </Text>
        ) : null}
        {message.attachments && message.attachments.length > 0 && (
          <MediaDisplay
            attachments={message.attachments}
            isOwnMessage={message.isOwnMessage}
          />
        )}
      </View>
      
      {message.reactions && message.reactions.length > 0 && (
        <TouchableOpacity 
          onPress={() => onReactionPress?.(message)}
          style={styles.reactionsContainer}
        >
          <View style={[styles.reactionsBubble, { backgroundColor: colors.surface }]}>
            {message.reactions.slice(0, 3).map((reaction, index) => (
              <Text key={index} style={styles.reactionEmoji}>
                {reaction.emoji}
              </Text>
            ))}
            {message.reactions.length > 3 && (
              <Text style={[styles.reactionCount, { color: colors.textSecondary }]}>
                +{message.reactions.length - 3}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      )}
      
      <View style={styles.metaContainer}>
        <Text style={[
          styles.timestamp,
          message.isOwnMessage ? styles.ownTimestamp : styles.otherTimestamp,
          { color: colors.textSecondary }
        ]}>
          {formatTime(message.timestamp)}
        </Text>
        {message.isOwnMessage && message.status && (
          <Text style={[styles.statusIcon, { color: getStatusColor(message.status) }]}>
            {getStatusIcon(message.status)}
          </Text>
        )}
        {message.readBy && message.readBy.length > 0 && (
          <Text style={[styles.readStatusText, { color: colors.statusRead }]}>
            既読{message.readBy.length}
          </Text>
        )}
      </View>
      
      {message.status === 'pending' && message.deliveryTime && (
        <Text style={[
          styles.deliveryTime,
          message.isOwnMessage ? styles.ownTimestamp : styles.otherTimestamp,
          { color: colors.statusPending }
        ]}>
          配信予定: {formatTime(message.deliveryTime)}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  messageContainer: {
    marginVertical: 6,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  senderName: {
    fontSize: 13,
    marginBottom: 3,
    marginLeft: 12,
    fontWeight: '500',
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 24,
    marginBottom: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  pendingBubble: {
    opacity: 0.7,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  pendingText: {
    fontStyle: 'italic',
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timestamp: {
    fontSize: 11,
    opacity: 0.7,
  },
  ownTimestamp: {
    textAlign: 'right',
    marginRight: 12,
  },
  otherTimestamp: {
    textAlign: 'left',
    marginLeft: 12,
  },
  statusIcon: {
    fontSize: 13,
    marginRight: 12,
  },
  deliveryTime: {
    fontSize: 10,
    marginTop: 2,
    fontStyle: 'italic',
    opacity: 0.6,
  },
  reactionsContainer: {
    marginTop: -10,
    marginBottom: 6,
    marginHorizontal: 12,
  },
  reactionsBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  reactionEmoji: {
    fontSize: 16,
    marginHorizontal: 2,
  },
  reactionCount: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  readStatusText: {
    fontSize: 10,
    fontWeight: '500',
    marginLeft: 8,
  },
});

export default MessageBubble;