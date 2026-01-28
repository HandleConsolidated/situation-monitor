/**
 * Supabase Client Setup
 *
 * Creates a Supabase client for fetching cached API data.
 * Only initializes in browser environment with valid configuration.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { browser } from '$app/environment';

// Environment variables for Supabase configuration
const SUPABASE_URL = browser
	? (import.meta.env?.VITE_SUPABASE_URL ?? '')
	: (process.env.VITE_SUPABASE_URL ?? '');

const SUPABASE_ANON_KEY = browser
	? (import.meta.env?.VITE_SUPABASE_ANON_KEY ?? '')
	: (process.env.VITE_SUPABASE_ANON_KEY ?? '');

const USE_SUPABASE = browser
	? (import.meta.env?.VITE_USE_SUPABASE ?? 'false')
	: (process.env.VITE_USE_SUPABASE ?? 'false');

/**
 * Supabase client instance - only created if properly configured
 * Returns null if:
 * - Not in browser environment
 * - Missing SUPABASE_URL or SUPABASE_ANON_KEY
 */
function createSupabaseClient(): SupabaseClient | null {
	// Only create client in browser with valid config
	if (!browser) {
		return null;
	}

	if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
		return null;
	}

	// Validate URL format
	try {
		new URL(SUPABASE_URL);
	} catch {
		console.warn('Invalid SUPABASE_URL format');
		return null;
	}

	return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
		auth: {
			persistSession: false, // No auth needed for read-only access
			autoRefreshToken: false
		},
		global: {
			headers: {
				'x-client-info': 'situation-monitor'
			}
		}
	});
}

export const supabase = createSupabaseClient();

/**
 * Check if Supabase is enabled and properly configured
 * Returns true if:
 * - VITE_USE_SUPABASE is set to 'true'
 * - Supabase client is successfully created
 */
export function isSupabaseEnabled(): boolean {
	return USE_SUPABASE === 'true' && supabase !== null;
}

/**
 * Get the Supabase client, throwing an error if not available
 * Use this when Supabase is required (after checking isSupabaseEnabled)
 */
export function getSupabaseClient(): SupabaseClient {
	if (!supabase) {
		throw new Error('Supabase client not available. Check configuration.');
	}
	return supabase;
}
