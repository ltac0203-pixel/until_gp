# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## SerenaMCP Integration

This project is enhanced with **Serena**, a semantic code analysis and editing toolkit that provides IDE-like capabilities for precise code navigation and modification.

### Serena Capabilities
- **Semantic Search**: Find symbols, references, and patterns across the TypeScript/JavaScript codebase
- **Precise Editing**: Modify code at the symbol level with language server understanding
- **Code Navigation**: Navigate between related components, services, and types
- **Dependency Analysis**: Understand import relationships and module dependencies

### Key Serena Commands for This Project
When working with this codebase, Serena can help with:
1. **Finding Components**: Search for React components by name or type
2. **Tracking Group Logic**: Navigate auto-disband functionality across services
3. **Theme Analysis**: Find all theme-related code and color usage
4. **Type Checking**: Validate TypeScript types and interfaces
5. **Refactoring**: Safely rename symbols and update references

### Project Context
Serena is configured with knowledge about:
- React Native/Expo structure and patterns
- TypeScript configuration (strict mode)
- Project-specific directories (src/components, src/screens, etc.)
- Ignored paths (node_modules, android, ios, .expo)

## Development Commands

**Start development server:**
```bash
npm start
# or platform-specific:
npm run android  # Android development
npm run ios      # iOS development
npm run web      # Web development
```

**Install dependencies:**
```bash
npm install
```

**TypeScript compilation:**
The project uses TypeScript with strict mode enabled (`tsconfig.json` extends `expo/tsconfig.base`). TypeScript errors will be shown by the Expo bundler during development.

## Project Concept

**FlowGroups** is an ephemeral group chat application where groups automatically disband after a set period or activity threshold. This eliminates the awkwardness of leaving groups and prevents the accumulation of inactive groups like in traditional messaging apps (e.g., LINE).

### Core Concept Features
- **Auto-disband**: Groups automatically dissolve based on:
  - Time limits (e.g., 24 hours, 7 days, 30 days)
  - Inactivity periods (e.g., no messages for 3 days)
  - Message count limits (e.g., after 100 messages)
- **No awkward exits**: Since groups are temporary by design, there's no social pressure when leaving
- **Clean chat history**: Past groups naturally archive themselves
- **Purpose-driven groups**: Each group is created with a specific lifespan in mind

## Architecture Overview

This is a React Native Expo application implementing ephemeral group chat functionality. Key architectural components:

### Core Stack
- **React Native 0.79.5** with **Expo SDK 53**
- **TypeScript** with strict mode
- **React Navigation** for screen navigation
- **AsyncStorage** for local data persistence

### Directory Structure
```
src/
├── components/     # Reusable UI components
├── contexts/       # React context providers (Theme, Groups)
├── screens/        # Screen components (GroupList, GroupChat, CreateGroup)
├── services/       # Business logic (storage, group management)
├── types/          # TypeScript type definitions
└── utils/          # Utility functions (themes, timers)
```

### Key Features Implementation

**Group System:**
- Groups have lifecycle states: active → expiring → archived
- Auto-disband triggers:
  - `expirationTime`: Absolute timestamp when group expires
  - `inactivityThreshold`: Days without messages before auto-disband
  - `messageLimit`: Maximum messages before group closes
- Group metadata includes creation time, member list, and disband reason
- Countdown timers show remaining group lifetime

**Data Persistence:**
- `StorageService` handles AsyncStorage operations
- Active and archived groups stored separately
- Automatic cleanup of old archived groups
- Member preferences and notification settings

**Theme System:**
- Light/dark theme support via `ThemeContext`
- Theme colors defined in `utils/themes.ts`
- Settings include theme preference and notification options

**User Experience:**
- Visual countdown indicators for group expiration
- Warning notifications before group disbands
- Smooth transitions when groups expire
- Archive view for past groups (read-only)
- Quick group creation with preset lifespans

### Component Patterns

Components follow these conventions:
- Functional components with hooks
- Theme colors accessed via `useTheme()` hook and `getThemeColors()`
- Platform-specific code uses `Platform.OS` checks
- Real-time updates for group status changes
- Optimistic UI updates for better responsiveness

### Group Lifecycle Management
- Background tasks check for expired groups via `StorageService.processExpiredGroups()`
- Groups transition to "expiring soon" state at 10% remaining lifetime
- Archived groups retained for 30 days for reference
- Members receive notifications at key lifecycle events
- Group joining via `JoinGroupScreen` with group codes

## Media Handling

The application supports image and video attachments in messages:
- **MediaStorage Service** (`services/mediaStorage.ts`) handles media file operations
- **Media Components**:
  - `MediaPicker`: Image/video selection from gallery
  - `MediaPreview`: Pre-send media preview with removal option
  - `MediaDisplay`: In-message media rendering with fullscreen view
- **Attachment Types**: Images and videos with metadata (dimensions, duration, thumbnails)

## Navigation Structure

**Stack Navigator (Root):**
- MainTabs
- GroupChat
- JoinGroup

**Tab Navigator (MainTabs):**
- Home: Active groups list
- Create: New group creation
- Archive: Past groups (read-only)
- Settings: App preferences

Navigation types are defined in `App.tsx` as `RootStackParamList` and `TabParamList`.

## Key Services

**StorageService (`services/storage.ts`):**
- `loadGroups()`: Retrieves active and archived groups
- `saveGroup()`: Persists group changes
- `processExpiredGroups()`: Handles group lifecycle transitions
- `createGroup()`: Creates new ephemeral group
- Default sample groups provided on first launch

**Group State Management:**
- Groups stored with full message history
- Automatic status updates based on expiration rules
- Unread count tracking per group
- Message delivery status tracking

## UI Patterns

**Blur Effects:**
- Tab bar uses `expo-blur` for glassmorphism effect
- Platform-specific blur intensity adjustments

**Haptic Feedback:**
- Message send confirmation
- Long press actions
- Button interactions (when enabled in settings)

**Japanese UI:**
- Tab labels and many UI elements use Japanese text
- Consider maintaining bilingual support where appropriate

## Dependencies

**Core Dependencies:**
- React Native 0.79.5 with Expo SDK 53
- TypeScript with strict mode
- React Navigation (stack & bottom tabs)
- AsyncStorage for persistence
- Expo modules: blur, haptics, image-picker, av, media-library
- React Native Vector Icons for Bootstrap Icons