import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const distDir = path.resolve(process.cwd(), 'dist')

function normalizeBase(value) {
  if (!value) return '/'
  let normalized = String(value).trim()
  if (!normalized.startsWith('/')) normalized = `/${normalized}`
  if (!normalized.endsWith('/')) normalized = `${normalized}/`
  return normalized
}

const base = normalizeBase(process.env.BASE_URL || '/kanameishi/')
const host = process.env.HOST || '127.0.0.1'
const port = Number(process.env.PORT || 4173)

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const type = contentTypes[ext] || 'application/octet-stream'
  res.statusCode = 200
  res.setHeader('Content-Type', type)
  fs.createReadStream(filePath).pipe(res)
}

function sendIndex(res) {
  sendFile(res, path.join(distDir, 'index.html'))
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || host}`)
    const pathname = url.pathname

    // Helpful redirect so opening http://host:port/ works.
    if (pathname === '/') {
      res.statusCode = 302
      res.setHeader('Location', base)
      res.end()
      return
    }

    if (!pathname.startsWith(base)) {
      res.statusCode = 404
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end(`Not found. Open ${base}`)
      return
    }

    const relativePath = pathname.slice(base.length) || 'index.html'
    const safePath = relativePath.replaceAll('..', '')
    const filePath = path.join(distDir, safePath)

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      sendFile(res, filePath)
      return
    }

    // SPA fallback
    sendIndex(res)
  } catch (e) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end(String(e?.message || e))
  }
})

server.listen(port, host, () => {
  console.log(`[preview-pages] serving ${distDir}`)
  console.log(`[preview-pages] base=${base}`)
  console.log(`[preview-pages] http://${host}:${port}${base}`)
})
