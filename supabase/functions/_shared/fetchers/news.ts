/**
 * News fetchers for Supabase Edge Functions
 * Fetches news from GDELT API
 */

export type NewsCategory = 'politics' | 'tech' | 'finance' | 'gov' | 'ai' | 'intel'

export interface NewsItem {
  id: string
  external_id: string
  category: NewsCategory
  title: string
  link: string
  source: string
  published_at: string | null
  summary: string | null
  image_url: string | null
  data: Record<string, unknown>
}

interface GdeltArticle {
  title: string
  url: string
  seendate: string
  domain: string
  socialimage?: string
}

interface GdeltResponse {
  articles?: GdeltArticle[]
}

// Category search queries for GDELT
const CATEGORY_QUERIES: Record<NewsCategory, string> = {
  politics: '(politics OR government OR election OR congress)',
  tech: '(technology OR software OR startup OR "silicon valley")',
  finance: '(finance OR "stock market" OR economy OR banking)',
  gov: '("federal government" OR "white house" OR congress OR regulation)',
  ai: '("artificial intelligence" OR "machine learning" OR AI OR ChatGPT)',
  intel: '(intelligence OR security OR military OR defense)'
}

/**
 * Simple hash function to generate unique IDs from URLs
 */
function hashCode(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

/**
 * Parse GDELT date format (20251202T224500Z) to ISO string
 */
function parseGdeltDate(dateStr: string, index: number = 0): string {
  if (!dateStr) {
    const now = new Date()
    now.setMinutes(now.getMinutes() - index)
    return now.toISOString()
  }

  const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/)
  if (match) {
    const [, year, month, day, hour, min, sec] = match
    const date = new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}Z`)
    if (!isNaN(date.getTime())) {
      return date.toISOString()
    }
  }

  const parsed = new Date(dateStr)
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString()
  }

  const now = new Date()
  now.setMinutes(now.getMinutes() - index)
  return now.toISOString()
}

/**
 * Fetch news for a specific category from GDELT
 */
export async function fetchCategoryNews(category: NewsCategory): Promise<NewsItem[]> {
  try {
    const query = CATEGORY_QUERIES[category]
    const fullQuery = `${query} sourcelang:english`
    const gdeltUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(fullQuery)}&timespan=24h&mode=artlist&maxrecords=25&format=json&sort=datedesc`

    const response = await fetch(gdeltUrl, {
      signal: AbortSignal.timeout(15000)
    })

    if (!response.ok) {
      throw new Error(`GDELT API returned ${response.status}`)
    }

    const contentType = response.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      console.warn(`Non-JSON response for ${category}:`, contentType)
      return []
    }

    const data: GdeltResponse = await response.json()

    if (!data?.articles) return []

    return data.articles.map((article, index) => {
      const urlHash = article.url ? hashCode(article.url) : Math.random().toString(36).slice(2)
      const externalId = `gdelt-${category}-${urlHash}-${index}`

      return {
        id: externalId,
        external_id: externalId,
        category,
        title: article.title || '',
        link: article.url || '',
        source: article.domain || 'Unknown',
        published_at: parseGdeltDate(article.seendate, index),
        summary: null,
        image_url: article.socialimage || null,
        data: {
          seendate: article.seendate,
          domain: article.domain
        }
      }
    })
  } catch (error) {
    console.error(`Error fetching ${category} news:`, error)
    return []
  }
}

/**
 * Fetch all news categories
 */
export async function fetchAllNews(): Promise<Record<NewsCategory, NewsItem[]>> {
  const categories: NewsCategory[] = ['politics', 'tech', 'finance', 'gov', 'ai', 'intel']
  const result: Record<NewsCategory, NewsItem[]> = {
    politics: [],
    tech: [],
    finance: [],
    gov: [],
    ai: [],
    intel: []
  }

  // Fetch sequentially with delays to avoid rate limiting
  for (let i = 0; i < categories.length; i++) {
    const category = categories[i]

    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    result[category] = await fetchCategoryNews(category)
  }

  return result
}
