import { createServer } from 'http'
import { readFile } from 'fs/promises'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const dist = join(__dirname, 'dist')
const port = parseInt(process.env.PORT || '3000', 10)

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
}

createServer(async (req, res) => {
  const url = req.url.split('?')[0]
  const filePath = join(dist, url === '/' ? 'index.html' : url)

  try {
    const data = await readFile(filePath)
    res.writeHead(200, { 'Content-Type': mime[extname(filePath)] || 'application/octet-stream' })
    res.end(data)
  } catch {
    // SPA fallback: cualquier ruta no encontrada devuelve index.html
    try {
      const html = await readFile(join(dist, 'index.html'))
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
    } catch {
      res.writeHead(500)
      res.end('Server error')
    }
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`MediYa corriendo en http://0.0.0.0:${port}`)
})
