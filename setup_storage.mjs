import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // 1. Create bucket if not exists
  console.log("Checking/creating bucket 'documents'...");
  const { data: buckets, error: getBucketsError } = await supabase.storage.listBuckets();

  if (getBucketsError) {
    console.error("Error fetching buckets:", getBucketsError);
  } else {
    const bucketExists = buckets.find(b => b.name === 'documents');
    if (!bucketExists) {
      console.log("Bucket 'documents' not found. Attempting to create...");
      const { data: createData, error: createError } = await supabase.storage.createBucket('documents', {
        public: true, // Assuming files should be public or accessible via signed URLs
      });
      if (createError) {
        console.error("Error creating bucket:", createError.message);
      } else {
        console.log("Bucket created successfully:", createData);
      }
    } else {
      console.log("Bucket 'documents' already exists.");
    }
  }

  // 2. Check for validity_date column by inserting a dummy record and rolling back or catching error
  console.log("Checking for validity_date column...");
  const { data, error } = await supabase
    .from('documents')
    .select('validity_date')
    .limit(1);

  if (error) {
    console.error("Error querying validity_date (it might not exist):", error.message);
  } else {
    console.log("validity_date column exists!");
  }
}

main();
