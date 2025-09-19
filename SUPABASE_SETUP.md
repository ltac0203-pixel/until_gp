# Supabase Setup Guide for GroupBy

This guide explains how to set up Supabase for the GroupBy ephemeral group chat application.

## Prerequisites

- A Supabase account (https://supabase.com)
- Node.js and npm installed
- Expo CLI installed

## Step 1: Create Supabase Project

1. Go to https://supabase.com and sign in to your account
2. Click "New Project"
3. Choose your organization
4. Fill in project details:
   - Name: `groupby` (or your preferred name)
   - Database Password: Choose a strong password
   - Region: Select the region closest to your users
5. Click "Create new project"
6. Wait for the project to be fully provisioned (this may take a few minutes)

## Step 2: Setup Database Schema

1. In your Supabase dashboard, go to the SQL Editor
2. Copy the contents of `supabase/schema.sql` from this project
3. Paste it into the SQL Editor and click "Run"
4. This will create all necessary tables, indexes, RLS policies, and functions

## Step 3: Configure Environment Variables

1. In your Supabase dashboard, go to Settings > API
2. Copy your Project URL and anon/public key
3. Create a `.env` file in the project root (copy from `.env.example`)
4. Add your Supabase credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Important**: Never commit your actual `.env` file to version control. It's already included in `.gitignore`.

## Step 4: Configure Storage Buckets

The application uses Supabase Storage for media files. The buckets will be created automatically when the app initializes, but you can also create them manually:

1. Go to Storage in your Supabase dashboard
2. Create two buckets:
   - `media` (for images and videos)
   - `thumbnails` (for image thumbnails)
3. Configure bucket settings:
   - Set them as private buckets
   - Enable RLS
   - Set appropriate file size limits (50MB for media, 5MB for thumbnails)

## Step 5: Configure Authentication

1. Go to Authentication > Settings in your Supabase dashboard
2. Configure your authentication providers:
   - **Email**: Enable email authentication
   - **Anonymous**: Enable anonymous users for guest access
   - **Social providers**: Optionally configure Google, Apple, etc.

3. Configure email templates (optional):
   - Go to Authentication > Email Templates
   - Customize the signup confirmation and password reset emails

## Step 6: Set Up Row Level Security (RLS)

RLS policies are automatically created by the schema script, but here's what they do:

- **Users**: Can only view and update their own profile
- **Groups**: Users can only see groups they're members of
- **Messages**: Users can only see messages in groups they belong to
- **Attachments**: Users can only see attachments for messages in their groups

## Step 7: Configure Realtime

Realtime subscriptions are automatically configured, but ensure they're enabled:

1. Go to Database > Replication in your Supabase dashboard
2. Enable realtime for these tables:
   - `groups`
   - `group_members`
   - `messages`
   - `attachments`

## Step 8: Install Dependencies

Run the following commands in your project directory:

```bash
npm install @supabase/supabase-js
npm install expo-image-manipulator
npm install base64-arraybuffer
```

## Step 9: Test the Setup

1. Start your development server:
   ```bash
   npm start
   ```

2. The app should now:
   - Show an authentication screen for new users
   - Allow anonymous login for quick testing
   - Offer data migration if you have existing AsyncStorage data
   - Connect to Supabase for all data operations

## Troubleshooting

### Common Issues

1. **Environment variables not loading**
   - Ensure your `.env` file is in the project root
   - Restart your development server after adding environment variables
   - Check that variable names start with `EXPO_PUBLIC_`

2. **Database connection errors**
   - Verify your Supabase URL and anon key are correct
   - Check that your Supabase project is fully provisioned
   - Ensure there are no extra spaces in your environment variables

3. **RLS policy errors**
   - Make sure you ran the complete schema script
   - Check that authentication is working properly
   - Verify users are being created in the `public.users` table

4. **Storage upload failures**
   - Ensure storage buckets are created and configured properly
   - Check that RLS policies allow the authenticated user to upload
   - Verify file size limits are appropriate

5. **Realtime not working**
   - Check that realtime is enabled for the relevant tables
   - Ensure your subscription is properly set up in the component
   - Verify there are no network issues

### Debug Mode

To enable debug logging for Supabase operations, you can add console logs in the services. Look for errors in:

- Browser/Metro console for client-side issues
- Supabase dashboard logs for server-side issues
- Network tab for request/response debugging

## Production Considerations

Before deploying to production:

1. **Security**:
   - Review and test all RLS policies
   - Ensure sensitive data is not exposed
   - Use environment-specific Supabase projects

2. **Performance**:
   - Monitor database performance
   - Set up appropriate indexes
   - Consider database scaling options

3. **Backup**:
   - Enable automated backups in Supabase
   - Test restore procedures
   - Consider point-in-time recovery needs

4. **Monitoring**:
   - Set up Supabase monitoring and alerts
   - Monitor API usage and costs
   - Track user activity and errors

## Migration from AsyncStorage

If you have existing data in AsyncStorage, the app will automatically detect it and offer migration options:

1. **Automatic Detection**: The app checks for existing AsyncStorage data on startup
2. **User Choice**: Users can choose to migrate data or start fresh
3. **Migration Process**: Data is transferred to Supabase and local storage is cleaned up
4. **Fallback**: If migration fails, users can still use the app with new data

## Support

For issues specific to this implementation, check:
- The application logs and error messages
- Supabase dashboard for server-side errors
- This project's GitHub issues (if applicable)

For Supabase-specific issues:
- Supabase documentation: https://supabase.com/docs
- Supabase Discord community
- Supabase GitHub repository