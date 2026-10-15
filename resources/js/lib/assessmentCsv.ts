import type { Application, SelectionComponent } from '../types/api'

/**
 * Escape single value for CSV output.
 */
function escapeCsv(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return ''
  const s = String(val).trim()
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes(';')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/**
 * Buat string CSV format impor nilai dengan UTF-8 BOM agar kompatibel 100% dengan Microsoft Excel.
 */
export function generateAssessmentTemplate(
  applications: Application[],
  components: SelectionComponent[],
  existingScores: Record<string, Record<string, string | number>> = {}
): string {
  // Baris Header
  const headers = ['no_pendaftaran', 'nama_calon_siswa']
  for (const c of components) {
    headers.push(c.code.toUpperCase())
  }

  const rows: string[] = []
  // Tambahkan UTF-8 Byte Order Mark (\uFEFF) untuk Excel
  rows.push('\uFEFF' + headers.map(escapeCsv).join(','))

  // Isi baris data calon siswa pada gelombang ini
  for (const app of applications) {
    const regNo = app.registration_number || app.id
    const row = [escapeCsv(regNo), escapeCsv(app.applicant_name)]
    const scoresForApp = existingScores[app.id] || {}

    for (const c of components) {
      const scoreVal = scoresForApp[c.id] ?? ''
      row.push(escapeCsv(scoreVal))
    }
    rows.push(row.join(','))
  }

  return rows.join('\r\n')
}

export interface ParsedScoreRow {
  applicationId: string
  registrationNumber: string
  applicantName: string
  scores: Record<string, string> // componentId -> score string
}

export interface ParseResult {
  rows: ParsedScoreRow[]
  totalParsed: number
  totalScoresToInput: number
  errors: string[]
  warnings: string[]
}

/**
 * Parsing konten CSV dari Excel dan cocokkan dengan siswa dan komponen aktif.
 */
export function parseAssessmentCsv(
  csvContent: string,
  applications: Application[],
  components: SelectionComponent[]
): ParseResult {
  const result: ParseResult = {
    rows: [],
    totalParsed: 0,
    totalScoresToInput: 0,
    errors: [],
    warnings: [],
  }

  // Bersihkan UTF-8 BOM jika ada
  let cleanContent = csvContent
  if (cleanContent.charCodeAt(0) === 0xfeff) {
    cleanContent = cleanContent.slice(1)
  }

  // Pecah per baris
  const lines = cleanContent.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) {
    result.errors.push('File CSV kosong atau tidak memiliki baris data.')
    return result
  }

  // Parse header
  const rawHeaders = splitCsvLine(lines[0]).map((h) => h.trim().toUpperCase())
  const regNoIndex = rawHeaders.findIndex((h) =>
    ['NO_PENDAFTARAN', 'NO_REG', 'NO PENDAFTARAN', 'REGISTRATION_NUMBER', 'NO'].includes(h)
  )

  if (regNoIndex === -1) {
    result.errors.push(
      'Kolom "no_pendaftaran" tidak ditemukan pada baris pertama file CSV. Harap gunakan template resmi yang disediakan.'
    )
    return result
  }

  // Map kolom komponen (kode atau nama komponen) -> SelectionComponent
  const colToComponent: Record<number, SelectionComponent> = {}
  for (let i = 0; i < rawHeaders.length; i++) {
    if (i === regNoIndex) continue
    const headerTitle = rawHeaders[i]
    // Cocokkan dengan kode atau nama komponen
    const match = components.find(
      (c) =>
        c.code.toUpperCase() === headerTitle ||
        c.name.toUpperCase() === headerTitle ||
        headerTitle.startsWith(c.code.toUpperCase())
    )
    if (match) {
      colToComponent[i] = match
    }
  }

  if (Object.keys(colToComponent).length === 0) {
    result.errors.push(
      `Tidak ditemukan kolom komponen seleksi yang cocok. Komponen yang tersedia: ${components
        .map((c) => c.code)
        .join(', ')}`
    )
    return result
  }

  // Buat lookup pendaftar by registration_number & id
  const appMapByReg = new Map<string, Application>()
  for (const app of applications) {
    if (app.registration_number) {
      appMapByReg.set(app.registration_number.trim().toUpperCase(), app)
    }
    appMapByReg.set(app.id.trim().toUpperCase(), app)
  }

  // Parse tiap baris data
  for (let lineIdx = 1; lineIdx < lines.length; lineIdx++) {
    const cols = splitCsvLine(lines[lineIdx])
    if (cols.length === 0 || cols.every((c) => !c.trim())) continue

    const regNo = (cols[regNoIndex] || '').trim()
    if (!regNo) continue

    const app = appMapByReg.get(regNo.toUpperCase())
    if (!app) {
      result.warnings.push(`Baris ${lineIdx + 1}: Pendaftar dengan No "${regNo}" tidak ditemukan pada gelombang ini.`)
      continue
    }

    const rowScores: Record<string, string> = {}
    let hasAtLeastOneScore = false

    for (const [colIdxStr, comp] of Object.entries(colToComponent)) {
      const colIdx = Number(colIdxStr)
      const rawVal = (cols[colIdx] || '').trim().replace(',', '.')
      if (!rawVal) continue

      const numVal = parseFloat(rawVal)
      if (isNaN(numVal)) {
        result.warnings.push(
          `Baris ${lineIdx + 1} (${app.applicant_name}): Nilai "${rawVal}" untuk ${comp.name} bukan angka yang valid.`
        )
        continue
      }

      const maxScore = parseFloat(comp.max_score) || 100
      if (numVal < 0 || numVal > maxScore) {
        result.warnings.push(
          `Baris ${lineIdx + 1} (${app.applicant_name}): Nilai ${numVal} untuk ${comp.name} melebihi rentang valid (0 - ${maxScore}).`
        )
        continue
      }

      rowScores[comp.id] = numVal.toString()
      hasAtLeastOneScore = true
      result.totalScoresToInput++
    }

    if (hasAtLeastOneScore) {
      result.rows.push({
        applicationId: app.id,
        registrationNumber: app.registration_number || app.id,
        applicantName: app.applicant_name,
        scores: rowScores,
      })
      result.totalParsed++
    }
  }

  return result
}

/**
 * Helper untuk memecah baris CSV dengan memperhitungkan tanda petik ganda dan koma/titik-koma.
 */
function splitCsvLine(line: string): string[] {
  // Deteksi pemisah (koma atau titik koma yang umum di Excel bahasa Indonesia)
  const delimiter = !line.includes(',') && line.includes(';') ? ';' : ','
  const pattern = new RegExp(
    `(\\s*"(?:[^"]|"")*"\\s*|[^${delimiter}]*)(?:[${delimiter}]|$)`,
    'g'
  )

  const values: string[] = []
  let match: RegExpExecArray | null

  while ((match = pattern.exec(line)) !== null) {
    let val = match[1].trim()
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1).replace(/""/g, '"')
    }
    values.push(val)
    if (match.index + match[0].length >= line.length) {
      break
    }
  }

  return values
}
