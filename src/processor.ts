import {
  AI_USES,
  FLOW,
  ITEMS,
  PREDICTION,
  READ_FULL_OPTIONS,
  STUDY_NO_AI,
  VERIFY_AI_OPTIONS,
  normalizeSecurityLevel,
  resolveSecurityAnswer,
  SECURITY_LEVEL_DOUBT,
  SECURITY_LEVEL_GUESS,
  SECURITY_LEVEL_SURE,
  VARIANTS,
  type ReadFullAnswer,
  type VariantKey,
  type VerifyAiAnswer,
} from './items.js'

export interface Trial {
  score: number
  predicted: number
  sureCorrect: number
  sureWrong: number
  doubtCorrect: number
  doubtWrong: number
  guessCorrect: number
  guessWrong: number
  items: boolean[]
}

export interface ProcessedPair {
  sex: 'Mujer' | 'Hombre'
  strategy: string
  studyMethod: string
  readFull?: ReadFullAnswer
  verifiedAi?: VerifyAiAnswer
  without: Trial
  with: Trial
}

export interface RoomQuality {
  missingIdentity: number
  incomplete: number
  duplicates: number
  inconsistent: number
}

export interface RoomResults {
  schemaVersion: 1
  roomId: string
  generatedAt: string
  pairs: ProcessedPair[]
  participants: number
  responses: number
  quality: RoomQuality
}

export interface SubmissionRow {
  email: string
  variant: VariantKey
  answers: Record<string, string>
}

export interface ProcessOutput {
  rooms: Record<string, RoomResults>
  unassigned: number
}

const CODE_RE = /^(2|4|5|6|8|9|101|102|108|109)-T1-S[12]$/
const SEXES = ['Mujer', 'Hombre'] as const

export function processRows(rows: SubmissionRow[], generatedAt: string): ProcessOutput {
  const rooms: Record<string, RoomResults> = {}
  const groups: Record<string, { row: SubmissionRow; code: string; room: string }[]> = {}
  let unassigned = 0

  for (const row of rows) {
    const code = String(row.answers['Código'] ?? row.answers.codigo ?? '').trim().toUpperCase()
    if (!CODE_RE.test(code)) {
      unassigned++
      continue
    }
    const room = code.replace(/-T1-S[12]$/, '')
    if (!rooms[room]) {
      rooms[room] = emptyRoom(room, generatedAt)
    }
    const output = rooms[room]
    output.responses++
    const email = String(row.email ?? row.answers.email ?? '').trim().toLowerCase()
    if (!email || !email.includes('@')) {
      output.quality.missingIdentity++
      continue
    }
    const key = `${room}:${email}`
    if (!groups[key]) {
      groups[key] = []
      output.participants++
    }
    groups[key].push({ row, code, room })
  }

  for (const records of Object.values(groups)) {
    const output = rooms[records[0].room]
    const variants = records.map((r) => VARIANTS.find((v) => v.clave === r.row.variant))
    if (variants.some((v) => !v)) {
      output.quality.inconsistent++
      continue
    }
    const withAi = variants.filter((v) => v!.condicion === 'conIA').length
    const withoutAi = variants.filter((v) => v!.condicion === 'sinIA').length
    if (records.length > 2 || withAi > 1 || withoutAi > 1) {
      output.quality.duplicates++
      continue
    }
    if (records.length < 2) {
      output.quality.incomplete++
      continue
    }
    const sexes = records.map((r) => r.row.answers.Sexo)
    if (
      records[0].code !== records[1].code ||
      variants[0]!.texto === variants[1]!.texto ||
      sexes[0] !== sexes[1] ||
      !SEXES.includes(sexes[0] as (typeof SEXES)[number])
    ) {
      output.quality.inconsistent++
      continue
    }

    const pair: ProcessedPair = {
      sex: sexes[0] as 'Mujer' | 'Hombre',
      strategy: '',
      studyMethod: '',
      without: emptyTrial(),
      with: emptyTrial(),
    }
    let invalid = false

    for (let index = 0; index < records.length; index++) {
      const v = variants[index]!
      const a = records[index].row.answers
      const pred = a[PREDICTION]
      if (!/^[0-6]$/.test(String(pred))) {
        invalid = true
        break
      }
      const trial = emptyTrial()
      trial.predicted = Number(pred)
      for (let i = 0; i < ITEMS[v.texto].length; i++) {
        const item = ITEMS[v.texto][i]
        const answer = item.opciones.find((o) => o.t === a[item.titulo])
        const security = normalizeSecurityLevel(resolveSecurityAnswer(a, i + 1))
        if (!answer || !security) {
          invalid = true
          break
        }
        const correct = Boolean(answer.c)
        trial.items.push(correct)
        if (correct) trial.score++
        if (security === SECURITY_LEVEL_SURE) {
          if (correct) trial.sureCorrect++
          else trial.sureWrong++
        } else if (security === SECURITY_LEVEL_DOUBT) {
          if (correct) trial.doubtCorrect++
          else trial.doubtWrong++
        } else if (security === SECURITY_LEVEL_GUESS) {
          if (correct) trial.guessCorrect++
          else trial.guessWrong++
        }
      }
      if (invalid) break
      if (v.condicion === 'conIA') {
        pair.with = trial
        const use = a[FLOW.conIA[0].titulo]
        if (!use) {
          invalid = true
          break
        }
        pair.strategy = (AI_USES as readonly string[]).includes(use) ? use : 'Otro flujo'
        const readFull = a[FLOW.conIA[1].titulo]?.trim()
        const verifiedAi = a[FLOW.conIA[2].titulo]?.trim()
        if (readFull && (READ_FULL_OPTIONS as readonly string[]).includes(readFull)) {
          pair.readFull = readFull as ReadFullAnswer
        }
        if (verifiedAi && (VERIFY_AI_OPTIONS as readonly string[]).includes(verifiedAi)) {
          pair.verifiedAi = verifiedAi as VerifyAiAnswer
        }
      } else {
        pair.without = trial
        const method = a[FLOW.sinIA[0].titulo]?.trim()
        if (method) {
          pair.studyMethod = (STUDY_NO_AI as readonly string[]).includes(method) ? method : 'Otro método'
        }
      }
    }

    if (invalid) output.quality.inconsistent++
    else output.pairs.push(pair)
  }

  return { rooms, unassigned }
}

function emptyRoom(roomId: string, generatedAt: string): RoomResults {
  return {
    schemaVersion: 1,
    roomId,
    generatedAt,
    pairs: [],
    participants: 0,
    responses: 0,
    quality: { missingIdentity: 0, incomplete: 0, duplicates: 0, inconsistent: 0 },
  }
}

function emptyTrial(): Trial {
  return {
    score: 0,
    predicted: 0,
    sureCorrect: 0,
    sureWrong: 0,
    doubtCorrect: 0,
    doubtWrong: 0,
    guessCorrect: 0,
    guessWrong: 0,
    items: [],
  }
}

export function getRoomResults(allRows: SubmissionRow[], roomId: string, generatedAt: string): RoomResults {
  const { rooms } = processRows(allRows, generatedAt)
  return rooms[roomId.toUpperCase()] ?? emptyRoom(roomId.toUpperCase(), generatedAt)
}
