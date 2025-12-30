/**
 * Minimal edge proxy for static hosting (GitHub Pages).
 *
 * Routes:
 *   /kmoni/*  -> https://www.kmoni.bosai.go.jp/*
 *   /msil/*   -> https://www.msil.go.jp/*
 *   /palert/* -> https://palert.earth.sinica.edu.tw/*
 *   /yahoo/*  -> https://weather-kyoshin.east.edge.storage-yahoo.jp/*
 *
 * Adds permissive CORS headers so browsers can read responses.
 *
 * Deploy on Cloudflare Workers (recommended) and set VITE_EDGE_PROXY_BASE to the worker URL.
 */

const ROUTES = [
  {
    prefix: '/kmoni/',
    targetOrigin: 'https://www.kmoni.bosai.go.jp',
  },
  {
    prefix: '/msil/',
    targetOrigin: 'https://www.msil.go.jp',
  },
  {
    prefix: '/palert/',
    targetOrigin: 'https://palert.earth.sinica.edu.tw',
    extraHeaders: {
      Origin: 'https://palert.earth.sinica.edu.tw',
      Referer: 'https://palert.earth.sinica.edu.tw/realtime',
    },
  },
  {
    prefix: '/yahoo/',
    targetOrigin: 'https://weather-kyoshin.east.edge.storage-yahoo.jp',
    extraHeaders: {
      Origin: 'https://weather.yahoo.co.jp',
      Referer: 'https://weather.yahoo.co.jp/',
    },
  },
]

function withCorsHeaders(headers) {
  const out = new Headers(headers)
  out.set('Access-Control-Allow-Origin', '*')
  out.set('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS')
  out.set('Access-Control-Allow-Headers', '*')
  out.set('Access-Control-Max-Age', '86400')
  return out
}

export default {
  async fetch(request) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: withCorsHeaders() })
    }

    const route = ROUTES.find((r) => url.pathname.startsWith(r.prefix))
    if (!route) {
      return new Response('Not found', { status: 404, headers: withCorsHeaders({ 'Content-Type': 'text/plain; charset=utf-8' }) })
    }

    const upstreamUrl = new URL(route.targetOrigin)
    upstreamUrl.pathname = url.pathname.replace(route.prefix, '/')
    upstreamUrl.search = url.search

    const upstreamHeaders = new Headers(request.headers)
    // Strip headers that can cause issues.
    upstreamHeaders.delete('Host')

    if (route.extraHeaders) {
      for (const [k, v] of Object.entries(route.extraHeaders)) upstreamHeaders.set(k, v)
    }

    const upstreamRequest = new Request(upstreamUrl.toString(), {
      method: request.method,
      headers: upstreamHeaders,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'follow',
    })

    const resp = await fetch(upstreamRequest)
    const headers = withCorsHeaders(resp.headers)
    return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers })
  },
}
