export interface RelatedCategory {
  axis: string
  category: string
  weight: number
}

export interface LikertQuestion {
  id: string
  axis: string
  primaryCategory: string
  prompt: string
  polarity: 'positive' | 'reverse'
  difficulty?: 'easy' | 'medium' | 'hard'
  required: boolean
  relatedCategories?: RelatedCategory[]
  tags?: Tag[]
}

export interface WeightedCategory {
  axis: string
  category: string
  score: number
  weight: number
}

export interface ForcedChoiceOption {
  key: string
  label: string
  primary: WeightedCategory
  secondary?: WeightedCategory[]
  tags?: Tag[]
}

export interface ForcedChoiceQuestion {
  id: string
  required: boolean
  prompt: string
  options: ForcedChoiceOption[]
}

export interface ScenarioOption {
  key: string
  label: string
  primary: WeightedCategory
  secondary?: WeightedCategory[]
  tags?: Tag[]
}

export interface ScenarioQuestion {
  id: string
  required: boolean
  title: string
  scenario: string
  options: ScenarioOption[]
}

export interface LikertAnswerPayload {
  id: string
  value: number
  responseTimeMs?: number
}

export interface ForcedChoiceAnswerPayload {
  id: string
  optionKey: string
  confidence: number
  responseTimeMs?: number
}

export interface ScenarioAnswerPayload {
  id: string
  rankedOptions: string[]
  responseTimeMs?: number
}

export interface ProfilePayload {
  nickname: string
  grade: string
  track: string
  email?: string
}

export interface AxisAveragePayload {
  [axis: string]: number
}

export interface ResponsePayload {
  profile: ProfilePayload
  likert: LikertAnswerPayload[]
  forcedChoice: ForcedChoiceAnswerPayload[]
  scenario: ScenarioAnswerPayload[]
  axisAverage?: AxisAveragePayload
  notes?: string
}

export interface QuestionBank {
  likert: LikertQuestion[]
  forcedChoice: ForcedChoiceQuestion[]
  scenario: ScenarioQuestion[]
}

export type Tag = { name: string; weight: number };
// Cache-busting comment

export interface ExternalResource {
  title: string
  url: string
}

export type AptitudeDetails = Record<
  string,
  {
    description: string
    related_fields: string[]
    learningContents: ExternalResource[]
    experienceEvents: ExternalResource[]
  }
>

export interface RecommendationItem {
  aptitude: string
  majors: string[]
  certifications: string[]
  activities: string[]
}

export {};
