import fs from 'node:fs'
import path from 'node:path'

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--csv') {
      args.csv = argv[i + 1]
      i += 1
    } else if (token === '--field') {
      args.field = argv[i + 1]
      i += 1
    } else if (token === '--dry-run') {
      args.dryRun = true
    } else if (token === '--help' || token === '-h') {
      args.help = true
    }
  }
  return args
}

function parseCsvLine(line) {
  const out = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (ch === ',' && !inQuotes) {
      out.push(current)
      current = ''
      continue
    }

    current += ch
  }

  out.push(current)
  return out
}

function loadElevationByCodeFromCsv(csvPath) {
  const buf = fs.readFileSync(csvPath)
  const text = buf.toString('utf8')

  const elevationByCode = new Map()
  const lines = text.split(/\r?\n/)

  for (const line of lines) {
    if (!line) continue
    const row = parseCsvLine(line)
    if (row.length < 6) continue

    const code = String(row[0] ?? '').trim()
    if (!code) continue

    const rawValue = String(row[5] ?? '').trim()
    if (!rawValue || rawValue.toUpperCase() === 'NA') continue

    const value = Number(rawValue)
    if (!Number.isFinite(value)) continue

    elevationByCode.set(code, value)
  }

  return elevationByCode
}

function loadJson(jsonPath) {
  const text = fs.readFileSync(jsonPath, 'utf8')
  return { data: JSON.parse(text), rawPrefix: text.slice(0, 5000) }
}

function writeJsonPreservingStyle(jsonPath, data, rawPrefix) {
  const looksPretty = rawPrefix.includes('\n')
  const json = looksPretty ? JSON.stringify(data, null, 2) + '\n' : JSON.stringify(data) + '\n'
  fs.writeFileSync(jsonPath, json, 'utf8')
}

function mergeFile({ jsonPath, elevationByCode, field, dryRun }) {
  if (!fs.existsSync(jsonPath)) {
    return { jsonPath, skipped: true, reason: 'not found' }
  }

  const { data, rawPrefix } = loadJson(jsonPath)
  if (!Array.isArray(data)) {
    throw new Error(`JSON is not an array: ${jsonPath}`)
  }

  let matched = 0
  let missingInCsv = 0

  for (const p of data) {
    const code = p?.code
    if (!code) continue

    if (elevationByCode.has(code)) {
      p[field] = elevationByCode.get(code)
      matched += 1
    } else {
      missingInCsv += 1
    }
  }

  const jsonCodeSet = new Set(data.map((p) => p?.code).filter(Boolean))
  const missingInJson = []
  for (const code of elevationByCode.keys()) {
    if (!jsonCodeSet.has(code)) missingInJson.push(code)
  }

  if (!dryRun) {
    writeJsonPreservingStyle(jsonPath, data, rawPrefix)
  }

  return {
    jsonPath,
    skipped: false,
    matched,
    missingInCsv,
    missingInJsonCount: missingInJson.length,
    missingInJsonSample: missingInJson.slice(0, 20),
  }
}

function main() {
  const args = parseArgs(process.argv)

  if (args.help || !args.csv) {
    console.log('Usage: node scripts/merge-kmoni-points-elevation.mjs --csv <path> [--field elevation] [--dry-run]')
    process.exit(args.help ? 0 : 1)
  }

  const csvPath = path.resolve(args.csv)
  const field = args.field || 'elevation'
  const dryRun = Boolean(args.dryRun)

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`)
    process.exit(1)
  }

  const elevationByCode = loadElevationByCodeFromCsv(csvPath)
  console.log(`CSV rows parsed into codes: ${elevationByCode.size}`)

  const rootDir = path.resolve('')
  const publicJsonPath = path.join(rootDir, 'public', 'resources', 'kmoni_points.json')
  const distJsonPath = path.join(rootDir, 'dist', 'resources', 'kmoni_points.json')

  const results = [
    mergeFile({ jsonPath: publicJsonPath, elevationByCode, field, dryRun }),
    mergeFile({ jsonPath: distJsonPath, elevationByCode, field, dryRun }),
  ]

  for (const r of results) {
    if (r.skipped) {
      console.log(`- ${r.jsonPath}: skipped (${r.reason})`)
      continue
    }
    console.log(`- ${r.jsonPath}: matched=${r.matched}, missingInCsv=${r.missingInCsv}, missingInJson=${r.missingInJsonCount}`)
    if (r.missingInJsonSample.length > 0) {
      console.log(`  missingInJson sample: ${r.missingInJsonSample.join(', ')}`)
    }
  }

  if (dryRun) {
    console.log('Dry-run: no files were written.')
  }
}

main()
