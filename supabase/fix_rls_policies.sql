-- Fix RLS policies for group_members table to resolve infinite recursion error
-- Run this script in your Supabase SQL editor

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view group memberships for their groups" ON public.group_members;
DROP POLICY IF EXISTS "Group admins can manage members" ON public.group_members;
DROP POLICY IF EXISTS "Admins can update member roles" ON public.group_members;
DROP POLICY IF EXISTS "Users can view other members in same groups" ON public.group_members;
DROP POLICY IF EXISTS "Users can view their own group memberships" ON public.group_members;

-- Create new, safe policies
CREATE POLICY "Users can view all group memberships" ON public.group_members
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own membership data" ON public.group_members
  FOR UPDATE USING (user_id = auth.uid());

-- Verify that other existing policies are still in place
-- Users can join groups
-- Users can leave groups