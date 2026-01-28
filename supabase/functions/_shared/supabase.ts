/**
 * Shared Supabase utilities for Edge Functions
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

let supabaseClient: SupabaseClient | null = null

/**
 * Get or create Supabase client with service role
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const url = Deno.env.get('SUPABASE_URL')
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!url || !key) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    }

    supabaseClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  }

  return supabaseClient
}

/**
 * Verify request authorization
 * Accepts either cron secret or service role key
 */
export function verifyAuth(req: Request): boolean {
  const authHeader = req.headers.get('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false
  }

  const token = authHeader.slice(7)
  const cronSecret = Deno.env.get('CRON_SECRET')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  return token === cronSecret || token === serviceKey
}

/**
 * Update sync status after function execution
 */
export async function updateSyncStatus(
  functionName: string,
  success: boolean,
  durationMs: number,
  error?: string
): Promise<void> {
  const supabase = getSupabaseClient()

  const now = new Date().toISOString()

  // First, ensure the record exists
  await supabase.from('sync_status').upsert({
    function_name: functionName,
    last_run: now,
    last_success: success ? now : undefined,
    last_error: success ? null : (error || 'Unknown error'),
    run_count: 1,
    error_count: success ? 0 : 1,
    avg_duration_ms: durationMs
  }, {
    onConflict: 'function_name',
    ignoreDuplicates: false
  })

  // Then update counters
  if (success) {
    await supabase.rpc('increment_run_count', { fn_name: functionName })
  } else {
    await supabase.rpc('increment_run_count', { fn_name: functionName })
    await supabase.rpc('increment_error_count', { fn_name: functionName })
  }
}

/**
 * Standard response helper
 */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
    }
  })
}

/**
 * CORS preflight response
 */
export function corsResponse(): Response {
  return new Response('ok', {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
    }
  })
}

/**
 * Error response helper
 */
export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ success: false, error: message }, status)
}
