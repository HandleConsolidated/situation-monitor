/**
 * Federal Reserve data fetcher for Supabase Edge Functions
 * Fetches Fed balance sheet data from FRED API
 */

export interface FedBalanceData {
  id: string
  date: string
  total_assets: number
  change_weekly: number
  change_percent: number
  data: Record<string, unknown>
}

interface FREDObservation {
  date: string
  value: string
}

interface FREDResponse {
  observations?: FREDObservation[]
}

/**
 * Fetch Federal Reserve balance sheet data from FRED
 */
export async function fetchFedBalance(): Promise<FedBalanceData | null> {
  const apiKey = Deno.env.get('FRED_API_KEY')

  if (!apiKey || apiKey === 'DEMO_API_KEY') {
    console.warn('No FRED API key configured')
    return getFallbackData()
  }

  try {
    // WALCL = Federal Reserve Total Assets (weekly)
    const fredUrl = 'https://api.stlouisfed.org/fred/series/observations?' +
      'series_id=WALCL' +
      `&api_key=${apiKey}` +
      '&file_type=json' +
      '&sort_order=desc' +
      '&limit=10'

    const response = await fetch(fredUrl, {
      signal: AbortSignal.timeout(15000)
    })

    if (!response.ok) {
      throw new Error(`FRED API returned ${response.status}`)
    }

    const data: FREDResponse = await response.json()

    if (!data.observations || data.observations.length < 2) {
      return getFallbackData()
    }

    const latest = data.observations[0]
    const previous = data.observations[1]

    const latestValue = parseFloat(latest.value)
    const previousValue = parseFloat(previous.value)

    if (isNaN(latestValue) || isNaN(previousValue)) {
      return getFallbackData()
    }

    // WALCL is in millions of dollars
    const totalAssets = latestValue * 1000000
    const previousAssets = previousValue * 1000000
    const changeWeekly = totalAssets - previousAssets
    const changePercent = (changeWeekly / previousAssets) * 100

    return {
      id: `fred-walcl-${latest.date}`,
      date: latest.date,
      total_assets: totalAssets,
      change_weekly: changeWeekly,
      change_percent: changePercent,
      data: {
        series_id: 'WALCL',
        previous_date: previous.date,
        previous_value: previousAssets,
        raw_value: latestValue
      }
    }
  } catch (error) {
    console.error('Error fetching Fed balance:', error)
    return getFallbackData()
  }
}

/**
 * Fallback data when API is unavailable
 */
function getFallbackData(): FedBalanceData {
  const today = new Date().toISOString().split('T')[0]

  // Approximate values based on recent Fed balance sheet (~$7T)
  return {
    id: `fed-fallback-${today}`,
    date: today,
    total_assets: 6800000000000, // ~$6.8T
    change_weekly: 0,
    change_percent: 0,
    data: {
      is_fallback: true,
      message: 'FRED API unavailable - showing approximate value'
    }
  }
}
