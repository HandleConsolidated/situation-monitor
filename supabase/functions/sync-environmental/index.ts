/**
 * Sync Environmental Edge Function
 * Fetches radiation readings and disease outbreaks data
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
  fetchRadiationData,
  fetchDiseaseOutbreaks
} from '../_shared/fetchers/environmental.ts'

const FUNCTION_NAME = 'sync-environmental'

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

    // Fetch all environmental data in parallel
    const [radiation, outbreaks] = await Promise.allSettled([
      fetchRadiationData(),
      fetchDiseaseOutbreaks()
    ])

    const now = new Date().toISOString()
    let upsertCount = 0
    let errorCount = 0

    // Process radiation readings
    if (radiation.status === 'fulfilled' && radiation.value.length > 0) {
      for (const reading of radiation.value) {
        // Extract station ID from the reading ID
        const stationId = reading.deviceId || reading.id

        const { error } = await supabase.from('radiation_readings').upsert({
          station_id: stationId,
          location: reading.location,
          country: null, // Would need geocoding to determine
          lat: reading.lat,
          lon: reading.lon,
          value: reading.value,
          unit: reading.unit,
          data: {
            level: reading.level,
            capturedAt: reading.capturedAt,
            originalId: reading.id
          },
          measured_at: reading.capturedAt,
          updated_at: now
        }, { onConflict: 'station_id' })

        if (error) {
          console.error(`Error upserting radiation ${stationId}:`, error)
          errorCount++
        } else {
          upsertCount++
        }
      }
    }

    // Process disease outbreaks
    if (outbreaks.status === 'fulfilled' && outbreaks.value.length > 0) {
      for (const outbreak of outbreaks.value) {
        const { error } = await supabase.from('disease_outbreaks').upsert({
          external_id: outbreak.id,
          disease: outbreak.disease,
          location: outbreak.country,
          country: outbreak.country,
          cases: outbreak.cases,
          deaths: outbreak.deaths,
          status: outbreak.status,
          data: {
            severity: outbreak.severity,
            startDate: outbreak.startDate,
            source: outbreak.source,
            url: outbreak.url,
            lat: outbreak.lat,
            lon: outbreak.lon
          },
          reported_at: outbreak.startDate || outbreak.lastUpdate,
          updated_at: now
        }, { onConflict: 'external_id' })

        if (error) {
          console.error(`Error upserting outbreak ${outbreak.id}:`, error)
          errorCount++
        } else {
          upsertCount++
        }
      }
    }

    // Clean up old radiation readings (older than 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('radiation_readings').delete().lt('measured_at', thirtyDaysAgo)

    const durationMs = Date.now() - startTime
    const success = errorCount === 0

    await updateSyncStatus(FUNCTION_NAME, success, durationMs, success ? undefined : `${errorCount} upsert errors`)

    console.log(`[${FUNCTION_NAME}] Sync complete: ${upsertCount} upserted, ${errorCount} errors, ${durationMs}ms`)

    return jsonResponse({
      success: true,
      function: FUNCTION_NAME,
      upserted: upsertCount,
      errors: errorCount,
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
