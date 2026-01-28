/**
 * Sync Storms Edge Function
 * Fetches tropical cyclones and convective outlooks data
 */

import {
  getSupabaseClient,
  verifyAuth,
  updateSyncStatus,
  jsonResponse,
  corsResponse,
  errorResponse
} from '../_shared/supabase.ts'
import {
  fetchActiveTropicalCyclones,
  fetchAllDay1Outlooks
} from '../_shared/fetchers/storms.ts'

const FUNCTION_NAME = 'sync-storms'

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

    // Fetch all storm data in parallel
    const [cyclones, outlooks] = await Promise.allSettled([
      fetchActiveTropicalCyclones(),
      fetchAllDay1Outlooks()
    ])

    const now = new Date().toISOString()
    let upsertCount = 0
    let errorCount = 0

    // Process tropical cyclones
    if (cyclones.status === 'fulfilled') {
      // First, clear old cyclones (they're either no longer active or have been updated)
      await supabase.from('tropical_cyclones').delete().neq('storm_id', '')

      for (const cyclone of cyclones.value) {
        const { error } = await supabase.from('tropical_cyclones').upsert({
          storm_id: cyclone.id,
          name: cyclone.name,
          basin: cyclone.basin,
          category: cyclone.category,
          max_wind: cyclone.maxWind,
          pressure: cyclone.minPressure,
          lat: cyclone.lat,
          lon: cyclone.lon,
          forecast_track: cyclone.forecast || null,
          forecast_cone: null,
          data: {
            movement: cyclone.movement,
            timestamp: cyclone.timestamp,
            source: cyclone.source,
            advisory: cyclone.advisory
          },
          updated_at: now
        }, { onConflict: 'storm_id' })

        if (error) {
          console.error(`Error upserting cyclone ${cyclone.id}:`, error)
          errorCount++
        } else {
          upsertCount++
        }
      }
    }

    // Process convective outlooks
    if (outlooks.status === 'fulfilled') {
      // Clear old outlooks first
      await supabase.from('convective_outlooks').delete().eq('day', 1)

      for (const outlook of outlooks.value) {
        const { error } = await supabase.from('convective_outlooks').upsert({
          day: 1,
          outlook_type: outlook.type,
          risk: outlook.risk,
          geometry: outlook.geometry,
          valid_time: outlook.validTime,
          data: {
            id: outlook.id,
            expirationTime: outlook.expirationTime,
            properties: outlook.properties
          },
          updated_at: now
        }, { onConflict: 'day,outlook_type,risk' })

        if (error) {
          console.error(`Error upserting outlook ${outlook.id}:`, error)
          errorCount++
        } else {
          upsertCount++
        }
      }
    }

    const durationMs = Date.now() - startTime
    const success = errorCount === 0

    await updateSyncStatus(FUNCTION_NAME, success, durationMs, success ? undefined : `${errorCount} upsert errors`)

    const cycloneCount = cyclones.status === 'fulfilled' ? cyclones.value.length : 0
    const outlookCount = outlooks.status === 'fulfilled' ? outlooks.value.length : 0

    console.log(`[${FUNCTION_NAME}] Sync complete: ${upsertCount} upserted, ${errorCount} errors, ${durationMs}ms`)
    console.log(`  Active cyclones: ${cycloneCount}, Outlooks: ${outlookCount}`)

    return jsonResponse({
      success: true,
      function: FUNCTION_NAME,
      upserted: upsertCount,
      errors: errorCount,
      active_cyclones: cycloneCount,
      outlooks: outlookCount,
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
