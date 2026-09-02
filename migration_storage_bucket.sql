-- SQL Script to create the 'documents' storage bucket and set up policies

-- 1. Create the bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable RLS on storage.objects (it usually is by default, but just in case)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Allow public read access to documents
CREATE POLICY "Public Access documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents');

-- 4. Policy: Allow authenticated users to upload documents
CREATE POLICY "Auth Upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- 5. Policy: Allow authenticated users to update their documents
CREATE POLICY "Auth Update documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'documents');

-- 6. Policy: Allow authenticated users to delete documents
CREATE POLICY "Auth Delete documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'documents');
