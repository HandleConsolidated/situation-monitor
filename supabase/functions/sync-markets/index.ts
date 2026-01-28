/**
 * Sync Markets Edge Function
 * Fetches crypto, indices, sectors, and commodities data and stores in Supabase
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
  fetchCryptoPrices,
  fetchIndices,
  fetchSectorPerformance,
  fetchCommodities
} from '../_shared/fetchers/markets.ts'

const FUNCTION_NAME = 'sync-markets'

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return corsResponse()
  }

  const startTime = Date.now()

  try {
    // Verify authorization (skip for local dev if needed)
    const isAuthorized = verifyAuth(req)
    if (!isAuthorized && Deno.env.get('DENO_DEPLOYMENT_ID')) {
      return errorResponse('Unauthorized', 401)
    }

    console.log(`[${FUNCTION_NAME}] Starting sync...`)

    const supabase = getSupabaseClient()

    // Fetch all market data in parallel
    const [crypto, indices, sectors, commodities] = await Promise.allSettled([
      fetchCryptoPrices(),
      fetchIndices(),
      fetchSectorPerformance(),
      fetchCommodities()
    ])

    const now = new Date().toISOString()
    let upsertCount = 0
    let errorCount = 0

    // Process crypto
    if (crypto.status === 'fulfilled' && crypto.value.length > 0) {
      for (const item of crypto.value) {
        const { error } = await supabase.from('market_data').upsert({
          type: 'crypto',
          symbol: item.symbol,
          data: {
            id: item.id,
            name: item.name,
            current_price: item.current_price,
            price_change_24h: item.price_change_24h,
            price_change_percentage_24h: item.price_change_percentage_24h
          },
          updated_at: now
        }, { onConflict: 'type,symbol' })

        if (error) {
          console.error(`Error upserting crypto ${item.symbol}:`, error)
          errorCount++
        } else {
          upsertCount++
        }
      }
    }

    // Process indices
    if (indices.status === 'fulfilled' && indices.value.length > 0) {
      for (const item of indices.value) {
        const { error } = await supabase.from('market_data').upsert({
          type: 'index',
          symbol: item.symbol,
          data: {
            name: item.name,
            price: item.price,
            change: item.change,
            changePercent: item.changePercent
          },
          updated_at: now
        }, { onConflict: 'type,symbol' })

        if (error) {
          console.error(`Error upserting index ${item.symbol}:`, error)
          errorCount++
        } else {
          upsertCount++
        }
      }
    }

    // Process sectors
    if (sectors.status === 'fulfilled' && sectors.value.length > 0) {
      for (const item of sectors.value) {
        const { error } = await supabase.from('market_data').upsert({
          type: 'sector',
          symbol: item.symbol,
          data: {
            name: item.name,
            price: item.price,
            change: item.change,
            changePercent: item.changePercent
          },
          updated_at: now
        }, { onConflict: 'type,symbol' })

        if (error) {
          console.error(`Error upserting sector ${item.symbol}:`, error)
          errorCount++
        } else {
          upsertCount++
        }
      }
    }

    // Process commodities
    if (commodities.status === 'fulfilled' && commodities.value.length > 0) {
      for (const item of commodities.value) {
        const { error } = await supabase.from('market_data').upsert({
          type: 'commodity',
          symbol: item.symbol,
          data: {
            name: item.name,
            price: item.price,
            change: item.change,
            changePercent: item.changePercent
          },
          updated_at: now
        }, { onConflict: 'type,symbol' })

        if (error) {
          console.error(`Error upserting commodity ${item.symbol}:`, error)
          errorCount++
        } else {
          upsertCount++
        }
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
