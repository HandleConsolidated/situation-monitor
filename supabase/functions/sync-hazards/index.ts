/**
 * Sync Hazards Edge Function
 * Fetches earthquakes, grid stress, and outages data and stores in Supabase
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
  fetchEarthquakes,
  fetchAllGridStress,
  fetchOutageData
} from '../_shared/fetchers/hazards.ts'

const FUNCTION_NAME = 'sync-hazards'

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

    // Fetch all hazard data in parallel
    const [earthquakes, gridStress, outages] = await Promise.allSettled([
      fetchEarthquakes(4.0),
      fetchAllGridStress(),
      fetchOutageData()
    ])

    const now = new Date().toISOString()
    let upsertCount = 0
    let errorCount = 0

    // Process earthquakes
    if (earthquakes.status === 'fulfilled' && earthquakes.value.length > 0) {
      for (const eq of earthquakes.value) {
        const { error } = await supabase.from('earthquakes').upsert({
          external_id: eq.id,
          magnitude: eq.magnitude,
          place: eq.place,
          lat: eq.lat,
          lon: eq.lon,
          depth: eq.depth,
          timestamp: new Date(eq.time).toISOString(),
          data: {
            url: eq.url
          },
          updated_at: now
        }, { onConflict: 'external_id' })

        if (error) {
          console.error(`Error upserting earthquake ${eq.id}:`, error)
          errorCount++
        } else {
          upsertCount++
        }
      }
    }

    // Process grid stress
    if (gridStress.status === 'fulfilled' && gridStress.value.length > 0) {
      for (const grid of gridStress.value) {
        const { error } = await supabase.from('grid_stress').upsert({
          region: grid.region,
          stress_level: grid.percent,
          status: grid.stressLevel,
          data: {
            country: grid.country,
            countryCode: grid.countryCode,
            lat: grid.lat,
            lon: grid.lon,
            moer: grid.moer,
            description: grid.description,
            signal_type: grid.signal_type,
            timestamp: grid.timestamp,
            areaKm2: grid.areaKm2
          },
          updated_at: now
        }, { onConflict: 'region' })

        if (error) {
          console.error(`Error upserting grid ${grid.region}:`, error)
          errorCount++
        } else {
          upsertCount++
        }
      }
    }

    // Process outages
    if (outages.status === 'fulfilled' && outages.value.length > 0) {
      for (const outage of outages.value) {
        const { error } = await supabase.from('outages').upsert({
          external_id: outage.id,
          location: outage.country,
          type: outage.type,
          severity: outage.severity,
          lat: outage.lat,
          lon: outage.lon,
          data: {
            countryCode: outage.countryCode,
            description: outage.description,
            source: outage.source,
            active: outage.active,
            radiusKm: outage.radiusKm
          },
          detected_at: now,
          updated_at: now
        }, { onConflict: 'external_id' })

        if (error) {
          console.error(`Error upserting outage ${outage.id}:`, error)
          errorCount++
        } else {
          upsertCount++
        }
      }
    }

    // Clean up old earthquakes (older than 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('earthquakes').delete().lt('timestamp', sevenDaysAgo)

    // Clean up inactive outages (older than 1 day)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('outages').delete().lt('detected_at', oneDayAgo)

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
