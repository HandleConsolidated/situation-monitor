/**
 * Sync News Edge Function
 * Fetches news from GDELT across categories and stores in Supabase
 */

import {
  getSupabaseClient,
  verifyAuth,
  updateSyncStatus,
  jsonResponse,
  corsResponse,
  errorResponse
} from '../_shared/supabase.ts'
import { fetchAllNews, NewsCategory } from '../_shared/fetchers/news.ts'

const FUNCTION_NAME = 'sync-news'

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

    // Fetch all news categories
    const newsByCategory = await fetchAllNews()

    const now = new Date().toISOString()
    let upsertCount = 0
    let errorCount = 0

    // Process each category
    const categories: NewsCategory[] = ['politics', 'tech', 'finance', 'gov', 'ai', 'intel']

    for (const category of categories) {
      const items = newsByCategory[category] || []

      for (const item of items) {
        const { error } = await supabase.from('news_items').upsert({
          external_id: item.external_id,
          category: item.category,
          title: item.title,
          link: item.link,
          source: item.source,
          published_at: item.published_at,
          summary: item.summary,
          image_url: item.image_url,
          data: item.data,
          updated_at: now
        }, { onConflict: 'external_id' })

        if (error) {
          console.error(`Error upserting news ${item.external_id}:`, error)
          errorCount++
        } else {
          upsertCount++
        }
      }
    }

    // Clean up old news (older than 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { error: deleteError } = await supabase
      .from('news_items')
      .delete()
      .lt('published_at', sevenDaysAgo)

    if (deleteError) {
      console.warn('Error cleaning old news:', deleteError)
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
