import type { LikertQuestion, RelatedCategory } from './types'

export interface AxisStats {
  sum: number
  count: number
}

export function initialiseAxisStats(questions: LikertQuestion[]): Map<string, AxisStats> {
  const map = new Map<string, AxisStats>()
  questions.forEach((q) => {
    if (!map.has(q.axis)) {
      map.set(q.axis, { sum: 0, count: 0 })
    }
  })
  return map
}

export function recordLikertStat(
  map: Map<string, AxisStats>,
  axis: string,
  value: number,
  polarity: 'positive' | 'reverse',
) {
  const stats = map.get(axis) ?? { sum: 0, count: 0 }
  const normalized = polarity === 'reverse' ? 8 - value : value
  stats.sum += normalized
  stats.count += 1
  map.set(axis, stats)
}

export function computeAxisAverage(stats: Map<string, AxisStats>): Record<string, number> {
  const result: Record<string, number> = {}
  stats.forEach((value, key) => {
    result[key] = value.count === 0 ? 0 : Number((value.sum / value.count).toFixed(2))
  })
  return result
}

export function computeInformationGain(
  question: LikertQuestion,
  stats: Map<string, AxisStats>,
): number {
  const axisState = stats.get(question.axis)
  if (!axisState || axisState.count === 0) {
    return 1.0
  }

  const average = axisState.sum / axisState.count
  const midPoint = 4
  const gap = Math.abs(midPoint - average)
  const relatedWeight = (question.relatedCategories ?? []).reduce(
    (acc: number, current: RelatedCategory) => acc + current.weight,
    0,
  )
  return gap * (1 + relatedWeight)
}

export function recomputeAxisStats(
  questions: LikertQuestion[],
  answers: Record<string, { value: number }>,
): Map<string, AxisStats> {
  const stats = initialiseAxisStats(questions)
  Object.entries(answers).forEach(([id, answer]) => {
    const question = questions.find((q) => q.id === id)
    if (question) {
      recordLikertStat(stats, question.axis, answer.value, question.polarity)
    }
  })
  return stats
}

export function pickNextLikertQuestion(
  questions: LikertQuestion[],
  answers: Record<string, { value: number }>,
  stats: Map<string, AxisStats>,
  requiredOnly = false,
): LikertQuestion | undefined {
  const answered = new Set(Object.keys(answers))
  const candidates = questions.filter((q) => !answered.has(q.id) && (!requiredOnly || q.required))
  if (candidates.length === 0 && requiredOnly) {
    return pickNextLikertQuestion(questions, answers, stats, false)
  }

  return candidates
    .map((question) => ({
      question,
      info: computeInformationGain(question, stats),
    }))
    .sort((a, b) => b.info - a.info)[0]?.question
}
