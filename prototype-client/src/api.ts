import type {
  QuestionBank,
  LikertQuestion,
  ForcedChoiceQuestion,
  ScenarioQuestion,
  ResponsePayload,
  AptitudeDetails,
  RecommendationItem,
} from './types'

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`)
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`)
  }
  return (await response.json()) as T
}

export async function fetchLikertQuestions(): Promise<LikertQuestion[]> {
  const root = await fetchJson<{ items: LikertQuestion[] }>('/questions/likert')
  return root.items
}

export async function fetchForcedChoiceQuestions(): Promise<ForcedChoiceQuestion[]> {
  const root = await fetchJson<{ items: ForcedChoiceQuestion[] }>('/questions/forced-choice')
  return root.items
}

export async function fetchScenarioQuestions(): Promise<ScenarioQuestion[]> {
  const root = await fetchJson<{ items: ScenarioQuestion[] }>('/questions/scenario')
  return root.items
}

export async function fetchQuestionBank(): Promise<QuestionBank> {
  const [likert, forcedChoice, scenario] = await Promise.all([
    fetchLikertQuestions(),
    fetchForcedChoiceQuestions(),
    fetchScenarioQuestions(),
  ])

  return { likert, forcedChoice, scenario }
}

export async function fetchCareerMap(): Promise<Record<string, string[]>> {
  const response = await fetch(`${API_BASE}/careers`)
  if (!response.ok) {
    throw new Error('Failed to fetch career map')
  }
  return response.json()
}

export async function fetchCategoryDetails(): Promise<Record<string, { description: string; fitReason: string; courses: string[] }>> {
  const response = await fetch(`${API_BASE}/categories/details`)
  if (!response.ok) {
    throw new Error('Failed to fetch category details')
  }
  return response.json()
}

export async function fetchAptitudeDetails(): Promise<AptitudeDetails> {
  const response = await fetch(`${API_BASE}/aptitudes/details`)
  if (!response.ok) {
    throw new Error('Failed to fetch aptitude details')
  }
  return response.json()
}

export async function fetchRecommendations(aptitudes: string[]): Promise<RecommendationItem[]> {
  if (aptitudes.length === 0) {
    return []
  }

  const response = await fetch(`${API_BASE}/recommendations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ aptitudes }),
  })

  if (!response.ok) {
    throw new Error('Failed to fetch recommendations')
  }

  const payload = (await response.json()) as { items?: RecommendationItem[] }
  return payload.items ?? []
}

export async function submitResponses(payload: ResponsePayload): Promise<void> {
  const response = await fetch(`${API_BASE}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Failed to submit responses');
  }
}
