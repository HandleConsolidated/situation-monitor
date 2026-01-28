/**
 * Sync Slow Edge Function
 * Fetches government contracts, layoffs, and world leaders data
 * These are "slow" data sources that don't need frequent updates
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
  fetchGovContracts,
  fetchLayoffs,
  fetchWorldLeaders
} from '../_shared/fetchers/slow.ts'

const FUNCTION_NAME = 'sync-slow'

/**
 * Parse leader "since" date strings like "Jan 2025" to ISO date
 */
function parseLeaderDate(since: string): string | null {
  try {
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    }

    const parts = since.toLowerCase().split(' ')
    if (parts.length === 2) {
      const month = months[parts[0].slice(0, 3)]
      const year = parseInt(parts[1], 10)
      if (month !== undefined && !isNaN(year)) {
        return new Date(year, month, 1).toISOString().split('T')[0]
      }
    }
    return null
  } catch {
    return null
  }
}

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

    // Fetch all slow data in parallel
    const [contracts, layoffs, leaders] = await Promise.allSettled([
      fetchGovContracts(),
      fetchLayoffs(),
      fetchWorldLeaders()
    ])

    const now = new Date().toISOString()
    let upsertCount = 0
    let errorCount = 0

    // Process government contracts
    if (contracts.status === 'fulfilled' && contracts.value.length > 0) {
      for (const contract of contracts.value) {
        const { error } = await supabase.from('gov_contracts').upsert({
          external_id: contract.id,
          recipient: contract.recipient,
          agency: contract.agency,
          amount: contract.amount,
          description: contract.description,
          award_date: contract.date,
          data: {
            state: contract.state,
            naicsCode: contract.naicsCode,
            contractType: contract.contractType
          },
          updated_at: now
        }, { onConflict: 'external_id' })

        if (error) {
          console.error(`Error upserting contract ${contract.id}:`, error)
          errorCount++
        } else {
          upsertCount++
        }
      }
    }

    // Process layoffs
    if (layoffs.status === 'fulfilled' && layoffs.value.length > 0) {
      for (const layoff of layoffs.value) {
        const externalId = `layoff-${layoff.company.toLowerCase().replace(/\s+/g, '-')}-${layoff.date}`

        const { error } = await supabase.from('layoffs').upsert({
          external_id: externalId,
          company: layoff.company,
          count: layoff.count,
          percentage: null,
          location: null,
          industry: 'tech', // Default to tech since we're sourcing from HN
          data: {
            title: layoff.title
          },
          announced_at: layoff.date,
          updated_at: now
        }, { onConflict: 'external_id' })

        if (error) {
          console.error(`Error upserting layoff ${externalId}:`, error)
          errorCount++
        } else {
          upsertCount++
        }
      }
    }

    // Process world leaders
    if (leaders.status === 'fulfilled' && leaders.value.length > 0) {
      for (const leader of leaders.value) {
        const { error } = await supabase.from('world_leaders').upsert({
          country: leader.country,
          leader_name: leader.name,
          title: leader.title,
          party: leader.party,
          took_office: leader.since ? parseLeaderDate(leader.since) : null,
          data: {
            id: leader.id,
            flag: leader.flag,
            keywords: leader.keywords,
            focus: leader.focus,
            news: leader.news?.slice(0, 5) // Store only latest 5 news items
          },
          updated_at: now
        }, { onConflict: 'country' })

        if (error) {
          console.error(`Error upserting leader ${leader.country}:`, error)
          errorCount++
        } else {
          upsertCount++
        }
      }
    }

    // Clean up old contracts (older than 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    await supabase.from('gov_contracts').delete().lt('award_date', thirtyDaysAgo)

    // Clean up old layoffs (older than 60 days)
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    await supabase.from('layoffs').delete().lt('announced_at', sixtyDaysAgo)

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
