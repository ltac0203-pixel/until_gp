-- GroupBy Database Schema for Supabase
-- This file contains all the SQL needed to set up the ephemeral group chat database

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Groups table with ephemeral features
CREATE TABLE public.groups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  inactivity_threshold INTEGER DEFAULT 3, -- days
  message_limit INTEGER,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expiring', 'archived')),
  invite_code TEXT UNIQUE,
  invite_code_expires_at TIMESTAMP WITH TIME ZONE,
  disbanded_at TIMESTAMP WITH TIME ZONE,
  disband_reason TEXT CHECK (disband_reason IN ('expired', 'inactive', 'message_limit', 'manual')),
  archived_until TIMESTAMP WITH TIME ZONE,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Group members (many-to-many relationship)
CREATE TABLE public.group_members (
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  unread_count INTEGER DEFAULT 0,
  PRIMARY KEY (group_id, user_id)
);

-- Messages table
CREATE TABLE public.messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'file')),
  reply_to UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  edited_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read'))
);

-- Attachments table for media files
CREATE TABLE public.attachments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  thumbnail_path TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_groups_status ON public.groups(status);
CREATE INDEX idx_groups_expires_at ON public.groups(expires_at);
CREATE INDEX idx_groups_last_activity ON public.groups(last_activity);
CREATE INDEX idx_groups_invite_code ON public.groups(invite_code);
CREATE INDEX idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX idx_messages_group_id ON public.messages(group_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);
CREATE INDEX idx_attachments_message_id ON public.attachments(message_id);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own profile
CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Group policies
CREATE POLICY "Users can view groups they are members of" ON public.groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = groups.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create groups" ON public.groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group admins can update groups" ON public.groups
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = groups.id AND user_id = auth.uid() AND role = 'admin'
    )
  );

-- Group members policies
CREATE POLICY "Users can view all group memberships" ON public.group_members
  FOR SELECT USING (true);

CREATE POLICY "Users can join groups" ON public.group_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave groups" ON public.group_members
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Users can update their own membership data" ON public.group_members
  FOR UPDATE USING (user_id = auth.uid());

-- Message policies
CREATE POLICY "Users can view messages in their groups" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = messages.group_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages to their groups" ON public.messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = messages.group_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can edit their own messages" ON public.messages
  FOR UPDATE USING (user_id = auth.uid());

-- Attachment policies
CREATE POLICY "Users can view attachments for messages in their groups" ON public.attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.group_members gm ON m.group_id = gm.group_id
      WHERE m.id = attachments.message_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add attachments to their messages" ON public.attachments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = attachments.message_id AND m.user_id = auth.uid()
    )
  );

-- Functions for ephemeral group management

-- Function to update group last activity
CREATE OR REPLACE FUNCTION update_group_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.groups
  SET last_activity = NOW(), updated_at = NOW()
  WHERE id = NEW.group_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update group activity when messages are sent
CREATE TRIGGER trigger_update_group_activity
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION update_group_last_activity();

-- Function to check and update expired groups
CREATE OR REPLACE FUNCTION process_expired_groups()
RETURNS void AS $$
BEGIN
  -- Mark groups as expired based on time
  UPDATE public.groups
  SET status = 'archived',
      disbanded_at = NOW(),
      disband_reason = 'expired',
      updated_at = NOW()
  WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();

  -- Mark groups as expired based on inactivity
  UPDATE public.groups
  SET status = 'archived',
      disbanded_at = NOW(),
      disband_reason = 'inactive',
      updated_at = NOW()
  WHERE status = 'active'
    AND inactivity_threshold IS NOT NULL
    AND last_activity < NOW() - INTERVAL '1 day' * inactivity_threshold;

  -- Mark groups as expired based on message limit
  UPDATE public.groups
  SET status = 'archived',
      disbanded_at = NOW(),
      disband_reason = 'message_limit',
      updated_at = NOW()
  WHERE status = 'active'
    AND message_limit IS NOT NULL
    AND (
      SELECT COUNT(*) FROM public.messages
      WHERE messages.group_id = groups.id
    ) >= message_limit;

  -- Mark groups as expiring soon (10% of lifetime remaining)
  UPDATE public.groups
  SET status = 'expiring',
      updated_at = NOW()
  WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at > NOW()
    AND expires_at < NOW() + (expires_at - created_at) * 0.1;
END;
$$ LANGUAGE plpgsql;

-- Function to generate unique invite codes
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists_code BOOLEAN;
BEGIN
  LOOP
    -- Generate 6-character alphanumeric code
    code := upper(substr(md5(random()::text), 1, 6));

    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM public.groups WHERE invite_code = code) INTO exists_code;

    -- Exit loop if code is unique
    EXIT WHEN NOT exists_code;
  END LOOP;

  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically set invite code on group creation
CREATE OR REPLACE FUNCTION set_group_invite_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invite_code IS NULL THEN
    NEW.invite_code := generate_invite_code();
    NEW.invite_code_expires_at := NOW() + INTERVAL '7 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set invite code on group creation
CREATE TRIGGER trigger_set_invite_code
  BEFORE INSERT ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION set_group_invite_code();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to update updated_at columns
CREATE TRIGGER trigger_update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create a scheduled job to process expired groups (requires pg_cron extension)
-- This would typically be set up in the Supabase dashboard
-- SELECT cron.schedule('process-expired-groups', '*/5 * * * *', 'SELECT process_expired_groups();');