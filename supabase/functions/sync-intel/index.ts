/**
 * Sync Intel Edge Function
 * Fetches Polymarket predictions, whale transactions, and conflict data
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
  fetchPolymarket,
  fetchWhaleTransactions,
  fetchConflicts
} from '../_shared/fetchers/intel.ts'

const FUNCTION_NAME = 'sync-intel'

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

    // Fetch all intel data in parallel
    const [predictions, whales, conflicts] = await Promise.allSettled([
      fetchPolymarket(),
      fetchWhaleTransactions(),
      fetchConflicts()
    ])

    const now = new Date().toISOString()
    let upsertCount = 0
    let errorCount = 0

    // Process Polymarket predictions
    if (predictions.status === 'fulfilled' && predictions.value.length > 0) {
      for (const pred of predictions.value) {
        const { error } = await supabase.from('predictions').upsert({
          external_id: pred.id,
          title: pred.question,
          category: pred.category,
          probability: pred.probability,
          volume: pred.volume,
          data: {
            slug: pred.slug,
            endDate: pred.endDate
          },
          updated_at: now
        }, { onConflict: 'external_id' })

        if (error) {
          console.error(`Error upserting prediction ${pred.id}:`, error)
          errorCount++
        } else {
          upsertCount++
        }
      }
    }

    // Process whale transactions
    if (whales.status === 'fulfilled' && whales.value.length > 0) {
      for (const tx of whales.value) {
        const { error } = await supabase.from('whale_transactions').upsert({
          tx_hash: tx.hash,
          token: tx.symbol,
          amount: tx.amount,
          usd_value: tx.amountUsd,
          from_address: tx.from,
          to_address: tx.to,
          transaction_type: tx.blockchain,
          data: {
            blockchain: tx.blockchain
          },
          timestamp: new Date(tx.timestamp * 1000).toISOString()
        }, { onConflict: 'tx_hash' })

        if (error) {
          console.error(`Error upserting whale tx ${tx.hash}:`, error)
          errorCount++
        } else {
          upsertCount++
        }
      }
    }

    // Process conflicts
    if (conflicts.status === 'fulfilled') {
      const conflictData = conflicts.value

      for (const hotspot of conflictData.hotspots) {
        const { error } = await supabase.from('conflicts').upsert({
          external_id: hotspot.id,
          name: hotspot.name,
          country: hotspot.country,
          region: hotspot.isoCode,
          type: 'conflict_forecast',
          intensity: hotspot.intensity,
          fatalities: Math.round(hotspot.forecastedFatalities),
          lat: hotspot.lat,
          lon: hotspot.lon,
          data: {
            fatalityProbability: hotspot.fatalityProbability,
            forecastMonth: hotspot.forecastMonth,
            forecastYear: hotspot.forecastYear,
            label: hotspot.label,
            riskDescription: hotspot.riskDescription,
            reasoning: hotspot.reasoning,
            dataSource: hotspot.dataSource,
            arcs: conflictData.arcs.filter(arc =>
              arc.from.name === hotspot.name || arc.to.name === hotspot.name
            ),
            forecastRun: conflictData.forecastRun
          },
          updated_at: now
        }, { onConflict: 'external_id' })

        if (error) {
          console.error(`Error upserting conflict ${hotspot.id}:`, error)
          errorCount++
        } else {
          upsertCount++
        }
      }
    }

    // Clean up old whale transactions (older than 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('whale_transactions').delete().lt('timestamp', oneDayAgo)

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
