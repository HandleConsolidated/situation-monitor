/**
 * Situation Monitor CORS Proxy - Cloudflare Worker
 *
 * Deploy this to your Cloudflare Workers account at:
 * https://dash.cloudflare.com/
 *
 * Usage:
 * - HTTP Proxy: https://your-worker.workers.dev/?url=https://api.example.com/endpoint
 * - WebSocket Proxy: wss://your-worker.workers.dev/ws/aisstream (for AIS Stream)
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle WebSocket upgrade for AIS Stream
    if (url.pathname === '/ws/aisstream') {
      return handleAISStreamWebSocket(request);
    }

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return handleCORS(request);
    }

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

/**
 * Handle WebSocket proxy for AIS Stream
 * Proxies WebSocket connections to wss://stream.aisstream.io/v0/stream
 *
 * Cloudflare Workers require using https:// with Upgrade header for outbound WebSockets
 */
async function handleAISStreamWebSocket(request) {
  // Check for WebSocket upgrade
  const upgradeHeader = request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    return new Response('Expected WebSocket upgrade', { status: 426 });
  }

  // Connect to AIS Stream using https:// with Upgrade header (Cloudflare Workers requirement)
  // This must be done BEFORE creating the WebSocketPair
  const aisStreamUrl = 'https://stream.aisstream.io/v0/stream';

  try {
    const aisResponse = await fetch(aisStreamUrl, {
      headers: {
        'Upgrade': 'websocket',
      },
    });

    const aisStream = aisResponse.webSocket;

    if (!aisStream) {
      return new Response(JSON.stringify({
        error: 'Failed to connect to AIS Stream',
        status: aisResponse.status,
        statusText: aisResponse.statusText
      }), {
        status: 502,
        headers: corsHeaders()
      });
    }

    // Accept the upstream connection
    aisStream.accept();

    // Create WebSocket pair for client connection
    const [client, server] = Object.values(new WebSocketPair());

    // Accept the client connection
    server.accept();

    // Forward messages from client to AIS Stream
    server.addEventListener('message', (event) => {
      try {
        if (aisStream.readyState === 1) { // WebSocket.OPEN = 1
          aisStream.send(event.data);
        }
      } catch (e) {
        console.error('Error forwarding to AIS Stream:', e);
      }
    });

    // Forward messages from AIS Stream to client
    aisStream.addEventListener('message', (event) => {
      try {
        if (server.readyState === 1) { // WebSocket.OPEN = 1
          server.send(event.data);
        }
      } catch (e) {
        console.error('Error forwarding to client:', e);
      }
    });

    // Handle client disconnect
    server.addEventListener('close', (event) => {
      try {
        aisStream.close(event.code, event.reason);
      } catch (e) {
        // Already closed
      }
    });

    // Handle AIS Stream disconnect
    aisStream.addEventListener('close', (event) => {
      try {
        server.close(event.code, event.reason);
      } catch (e) {
        // Already closed
      }
    });

    // Handle errors
    server.addEventListener('error', () => {
      try { aisStream.close(); } catch (e) { /* ignore */ }
    });

    aisStream.addEventListener('error', () => {
      try { server.close(); } catch (e) { /* ignore */ }
    });

    return new Response(null, {
      status: 101,
      webSocket: client
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'WebSocket proxy error',
      message: error.message
    }), {
      status: 502,
      headers: corsHeaders()
    });
  }
}
