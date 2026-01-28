/**
 * Sync Fed Edge Function
 * Fetches Federal Reserve balance sheet data from FRED
 */

import {
  getSupabaseClient,
  verifyAuth,
  updateSyncStatus,
  jsonResponse,
  corsResponse,
  errorResponse
} from '../_shared/supabase.ts'
import { fetchFedBalance } from '../_shared/fetchers/fed.ts'

const FUNCTION_NAME = 'sync-fed'

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return corsResponse()
  }

  const startTime = Date.now()

  try {
    // Verify authorization
    const isAuthorized = verifyAuth(req)
    if (!isAuthorized && Deno.env.get('DENO_DEPLOYMENT_ID')) {
      return errorResponse('Unauthorized', 401)
    }

    console.log(`[${FUNCTION_NAME}] Starting sync...`)

    const supabase = getSupabaseClient()

    // Fetch Fed balance data
    const fedData = await fetchFedBalance()

    const now = new Date().toISOString()
    let upsertCount = 0
    let errorCount = 0

    if (fedData) {
      const { error } = await supabase.from('fed_balance').upsert({
        date: fedData.date,
        total_assets: fedData.total_assets,
        data: {
          change_weekly: fedData.change_weekly,
          change_percent: fedData.change_percent,
          ...fedData.data
        },
        updated_at: now
      }, { onConflict: 'date' })

      if (error) {
        console.error(`Error upserting Fed balance:`, error)
        errorCount++
      } else {
        upsertCount++
      }
    }

    // Keep only last 52 weeks of Fed data
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    await supabase.from('fed_balance').delete().lt('date', oneYearAgo)

    const durationMs = Date.now() - startTime
    const success = errorCount === 0

    await updateSyncStatus(FUNCTION_NAME, success, durationMs, success ? undefined : 'Upsert failed')

    console.log(`[${FUNCTION_NAME}] Sync complete: ${upsertCount} upserted, ${errorCount} errors, ${durationMs}ms`)

    return jsonResponse({
      success: true,
      function: FUNCTION_NAME,
      upserted: upsertCount,
      errors: errorCount,
      fed_date: fedData?.date || null,
      total_assets: fedData?.total_assets || null,
      duration_ms: durationMs
    })
  } catch (error) {
    const durationMs = Date.now() - startTime
    const message = error instanceof Error ? error.message : 'Unknown error'

    console.error(`[${FUNCTION_NAME}] Error:`, error)

    await updateSyncStatus(FUNCTION_NAME, false, durationMs, message)

    return errorResponse(message)
  }
})
