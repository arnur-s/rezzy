/**
 * Minimal static server for the production build, with SPA fallback.
 *
 * Shared by the smoke and budget scripts so both are self-contained: `pnpm
 * build && pnpm smoke` is the whole workflow, with no separately managed
 * preview server to start and forget to stop.
 *
 * Deliberately not `vite preview`: a spawned server is awkward to shut down
 * reliably on Windows, and serving a directory is all this needs.
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { createServer } from 'node:http'
import { gzipSync } from 'node:zlib'

const MIME = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
}

export const DIST = 'dist'

export function hasBuild() {
  return existsSync(join(DIST, 'index.html'))
}

export function serveDist(port) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0])
    // normalize + prefix check keeps `..` from escaping dist.
    const candidate = normalize(join(DIST, path))
    const isFile =
      candidate.startsWith(normalize(DIST)) &&
      existsSync(candidate) &&
      statSync(candidate).isFile()

    // Only unknown *routes* fall back to index.html. A missing asset must 404,
    // otherwise a chunk dropped by re-chunking would be served as HTML and a
    // broken build could pass for a working one.
    if (!isFile && extname(path)) {
      res.writeHead(404).end('not found')
      return
    }

    const file = isFile ? candidate : join(DIST, 'index.html')
    const type = MIME[extname(file)] ?? 'application/octet-stream'

    // Compress text assets. Any real host does, so serving them raw would
    // report transfer sizes ~3x what a user actually downloads and make the
    // budget meaningless.
    const shouldCompress =
      /gzip/.test(req.headers['accept-encoding'] ?? '') &&
      /^(text|application\/(javascript|json)|image\/svg)/.test(type)

    if (shouldCompress) {
      const body = gzipSync(readFileSync(file))
      res.writeHead(200, {
        'Content-Type': type,
        'Content-Encoding': 'gzip',
        'Content-Length': body.length,
      })
      res.end(body)
      return
    }

    res.writeHead(200, { 'Content-Type': type })
    createReadStream(file).pipe(res)
  })

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve(server))
  })
}
