

const SUPABASE_URL = "https://aggqmjxhnsbmsymwblqg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnZ3FtanhobnNibXN5bXdibHFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNjQ0NTgsImV4cCI6MjA3ODk0MDQ1OH0.YZmrw7-LtIjlvTkU0c7G8qZ2VDNO8PeHudkGVo1PQ8Q";

// Import the Supabase client library from the CDN
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Create and export the Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
