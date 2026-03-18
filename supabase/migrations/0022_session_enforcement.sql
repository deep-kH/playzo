-- Migration: Add active_device_id column to profiles for single-session enforcement
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS active_device_id TEXT DEFAULT NULL;
