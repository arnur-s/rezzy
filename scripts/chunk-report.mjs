/**
 * Per-route chunk cost for the built app.
 *
 * The smoke and budget checks can only reach public routes without a session,
 * but the routes users actually navigate between are authenticated. This reads
 * the build output directly, so every route's chunk is measured whether or not
 * a test can log in.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const DIR = 'dist/assets'
const files = readdirSync(DIR).filter((f) => f.endsWith('.js'))

const rows = files
  .map((name) => {
    const raw = readFileSync(`${DIR}/${name}`)
    return {
      name,
      kb: statSync(`${DIR}/${name}`).size / 1024,
      gzipKb: gzipSync(raw).length / 1024,
    }
  })
  .sort((a, b) => b.gzipKb - a.gzipKb)

const total = rows.reduce((s, r) => s + r.gzipKb, 0)
console.log(`${rows.length} chunks, ${total.toFixed(0)} kB gzip total\n`)
console.log('  gzip     raw    chunk')
for (const r of rows.slice(0, 20)) {
  console.log(
    `${r.gzipKb.toFixed(1).padStart(7)} ${r.kb.toFixed(1).padStart(8)}    ${r.name}`,
  )
}

// The icon barrel is the regression this guards: any chunk carrying the full
// Lucide set reappears here as a several-hundred-kB entry.
const lucide = rows.find((r) => r.name.startsWith('lucide-react-'))
if (lucide && lucide.gzipKb > 40) {
  console.error(
    `\nREGRESSION: lucide chunk is ${lucide.gzipKb.toFixed(1)} kB gzip; the full icon set is back.`,
  )
  process.exit(1)
}
console.log(
  `\nlucide chunk: ${lucide ? lucide.gzipKb.toFixed(1) + ' kB gzip' : 'absent'} (budget 40 kB)`,
)
