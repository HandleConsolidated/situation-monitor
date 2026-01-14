/**
 * Situation Monitor CORS Proxy - Cloudflare Worker
 *
 * Deploy this to your Cloudflare Workers account at:
 * https://dash.cloudflare.com/
 *
 * Usage: https://your-worker.workers.dev/?url=https://api.example.com/endpoint
 */

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return handleCORS(request);
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    // Validate target URL
    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: corsHeaders()
      });
    }

    let decodedUrl;
    try {
      decodedUrl = decodeURIComponent(targetUrl);
    } catch {
      decodedUrl = targetUrl;
    }

    // Validate URL format
    try {
      new URL(decodedUrl);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL format' }), {
        status: 400,
        headers: corsHeaders()
      });
    }

    try {
      // Forward the request to the target URL
      const headers = new Headers();

      // Copy relevant headers from the original request
      const headersToForward = [
        'accept',
        'accept-language',
        'content-type',
        'authorization',  // Important for authenticated APIs like WattTime
        'x-api-key',
        'x-requested-with'
      ];

      for (const header of headersToForward) {
        const value = request.headers.get(header);
        if (value) {
          headers.set(header, value);
        }
      }

      // Set a default Accept header if not provided
      if (!headers.has('accept')) {
        headers.set('accept', 'application/json');
      }

      // Make the proxied request
      const proxyResponse = await fetch(decodedUrl, {
        method: request.method,
        headers: headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
        redirect: 'follow'
      });

      // Create response with CORS headers
      const responseHeaders = corsHeaders();

      // Copy content-type from the proxied response
      const contentType = proxyResponse.headers.get('content-type');
      if (contentType) {
        responseHeaders.set('content-type', contentType);
      }

      // Copy cache headers if present
      const cacheControl = proxyResponse.headers.get('cache-control');
      if (cacheControl) {
        responseHeaders.set('cache-control', cacheControl);
      }

      return new Response(proxyResponse.body, {
        status: proxyResponse.status,
        statusText: proxyResponse.statusText,
        headers: responseHeaders
      });

    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Proxy request failed',
        message: error.message,
        url: decodedUrl
      }), {
        status: 502,
        headers: corsHeaders()
      });
    }
  }
};

/**
 * Handle CORS preflight (OPTIONS) requests
 */
function handleCORS(request) {
  const headers = corsHeaders();

  // Handle preflight request
  const requestHeaders = request.headers.get('access-control-request-headers');
  if (requestHeaders) {
    headers.set('access-control-allow-headers', requestHeaders);
  }

  return new Response(null, {
    status: 204,
    headers: headers
  });
}

/**
 * Generate CORS headers
 */
function corsHeaders() {
  return new Headers({
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
    'access-control-allow-headers': 'Content-Type, Authorization, Accept, X-Requested-With, X-API-Key',
    'access-control-max-age': '86400',  // Cache preflight for 24 hours
    'access-control-expose-headers': 'Content-Type, Content-Length'
  });
}
