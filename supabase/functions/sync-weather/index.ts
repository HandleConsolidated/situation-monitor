/**
 * Sync Weather Edge Function
 * Fetches weather alerts from NWS and stores in Supabase
 */

import {
  getSupabaseClient,
  verifyAuth,
  updateSyncStatus,
  jsonResponse,
  corsResponse,
  errorResponse
} from '../_shared/supabase.ts'
import { fetchAllActiveAlerts } from '../_shared/fetchers/weather.ts'

const FUNCTION_NAME = 'sync-weather'

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

    // Fetch all active weather alerts
    const alerts = await fetchAllActiveAlerts()

    const now = new Date().toISOString()
    let upsertCount = 0
    let errorCount = 0

    // Clear expired alerts first
    const { error: deleteError } = await supabase
      .from('weather_alerts')
      .delete()
      .lt('expires', now)

    if (deleteError) {
      console.warn('Error clearing expired alerts:', deleteError)
    }

    // Upsert each alert
    for (const alert of alerts) {
      const { error } = await supabase.from('weather_alerts').upsert({
        external_id: alert.external_id,
        event: alert.event,
        severity: alert.severity,
        urgency: alert.urgency,
        certainty: alert.certainty,
        area_desc: alert.area_desc,
        headline: alert.headline,
        description: alert.description,
        instruction: alert.instruction,
        onset: alert.onset,
        expires: alert.expires,
        geometry: alert.geometry,
        data: alert.data,
        updated_at: now
      }, { onConflict: 'external_id' })

      if (error) {
        console.error(`Error upserting alert ${alert.external_id}:`, error)
        errorCount++
      } else {
        upsertCount++
      }
    }

    const durationMs = Date.now() - startTime
    const success = errorCount === 0

    await updateSyncStatus(FUNCTION_NAME, success, durationMs, success ? undefined : `${errorCount} upsert errors`)

    console.log(`[${FUNCTION_NAME}] Sync complete: ${upsertCount} upserted, ${errorCount} errors, ${durationMs}ms`)

    return jsonResponse({
      success: true,
      function: FUNCTION_NAME,
      upserted: upsertCount,
      errors: errorCount,
      active_alerts: alerts.length,
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
