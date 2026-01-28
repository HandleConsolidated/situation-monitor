/**
 * Weather alert fetchers for Supabase Edge Functions
 * Fetches alerts from National Weather Service API
 */

const NWS_BASE_URL = 'https://api.weather.gov'
const NWS_USER_AGENT = 'SituationMonitor/1.0 (supabase-backend)'

export interface WeatherAlert {
  id: string
  external_id: string
  event: string
  severity: string
  urgency: string
  certainty: string
  area_desc: string
  headline: string | null
  description: string
  instruction: string | null
  onset: string | null
  expires: string
  geometry: unknown | null
  data: Record<string, unknown>
}

interface NWSAlertFeature {
  id: string
  properties: {
    id: string
    areaDesc: string
    geocode: {
      SAME: string[]
      UGC: string[]
    }
    affectedZones: string[]
    sent: string
    effective: string
    onset: string | null
    expires: string
    ends: string | null
    status: string
    messageType: string
    category: string
    severity: string
    certainty: string
    urgency: string
    event: string
    sender: string
    senderName: string
    headline: string | null
    description: string
    instruction: string | null
    response: string
    parameters: Record<string, string[]>
  }
  geometry: unknown | null
}

interface NWSAlertResponse {
  features: NWSAlertFeature[]
}

/**
 * Fetch all active weather alerts from NWS
 */
export async function fetchAllActiveAlerts(): Promise<WeatherAlert[]> {
  try {
    const response = await fetch(`${NWS_BASE_URL}/alerts/active`, {
      headers: {
        'User-Agent': NWS_USER_AGENT,
        Accept: 'application/geo+json'
      },
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) {
      throw new Error(`NWS API returned ${response.status}`)
    }

    const data: NWSAlertResponse = await response.json()

    if (!data.features || !Array.isArray(data.features)) {
      console.warn('No alert features in NWS response')
      return []
    }

    return data.features.map(feature => {
      const props = feature.properties

      return {
        id: props.id,
        external_id: props.id,
        event: props.event || '',
        severity: props.severity || 'Unknown',
        urgency: props.urgency || 'Unknown',
        certainty: props.certainty || 'Unknown',
        area_desc: props.areaDesc || '',
        headline: props.headline,
        description: props.description || '',
        instruction: props.instruction,
        onset: props.onset,
        expires: props.expires || '',
        geometry: feature.geometry,
        data: {
          geocode: props.geocode,
          affectedZones: props.affectedZones,
          sent: props.sent,
          effective: props.effective,
          ends: props.ends,
          status: props.status,
          messageType: props.messageType,
          category: props.category,
          sender: props.sender,
          senderName: props.senderName,
          response: props.response,
          parameters: props.parameters
        }
      }
    })
  } catch (error) {
    console.error('Error fetching weather alerts:', error)
    return []
  }
}
