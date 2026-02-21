ALTER TABLE public.restaurants ADD COLUMN card_image_url TEXT;

-- Increase bucket size limit to 5MB for AI-generated card images
UPDATE storage.buckets SET file_size_limit = 5242880 WHERE id = 'restaurant-logos';

-- Allow owners to select files in their restaurant folder (needed for upsert)
CREATE POLICY "owner_select_logo"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'restaurant-logos'
    AND (string_to_array(name, '/'))[1] = (SELECT public.get_restaurant_id())::TEXT
    AND (SELECT public.get_app_role()) = 'owner'
  );

-- Allow owners to update (upsert) files in their restaurant folder
CREATE POLICY "owner_update_logo"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'restaurant-logos'
    AND (string_to_array(name, '/'))[1] = (SELECT public.get_restaurant_id())::TEXT
    AND (SELECT public.get_app_role()) = 'owner'
  )
  WITH CHECK (
    bucket_id = 'restaurant-logos'
    AND (string_to_array(name, '/'))[1] = (SELECT public.get_restaurant_id())::TEXT
    AND (SELECT public.get_app_role()) = 'owner'
  );
