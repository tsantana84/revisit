-- =============================================================================
-- Migration 0006: Restaurant logos storage bucket
-- Creates public bucket for logo uploads with owner-only write RLS
-- =============================================================================

-- Create the restaurant-logos bucket (public: logos are served as CDN assets)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'restaurant-logos',
  'restaurant-logos',
  true,
  1048576,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: Only authenticated owners can upload to their own restaurant's folder
-- Path convention: restaurant-logos/{restaurant_id}/{filename}
-- Using string_to_array instead of storage.foldername() for local CLI compatibility
CREATE POLICY "owner_upload_logo"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'restaurant-logos'
    AND (string_to_array(name, '/'))[1] = (SELECT public.get_restaurant_id())::TEXT
    AND (SELECT public.get_app_role()) = 'owner'
  );

CREATE POLICY "owner_delete_logo"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'restaurant-logos'
    AND (string_to_array(name, '/'))[1] = (SELECT public.get_restaurant_id())::TEXT
    AND (SELECT public.get_app_role()) = 'owner'
  );

-- Public bucket handles SELECT without RLS for CDN serving
-- No SELECT policy needed for public buckets
