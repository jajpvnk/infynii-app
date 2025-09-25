import { createClient } from '@supabase/supabase-js'
import type { Database } from '@jpvnk/infynii-shared'

const supabaseAdmin = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export default supabaseAdmin
