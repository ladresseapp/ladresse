import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://pyvruioduqkyiwezqmdh.supabase.co'
const SUPABASE_KEY = 'sb_publishable_md8OVklC6XVsUw9sQ8zxqQ_lhTDgD8e'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)