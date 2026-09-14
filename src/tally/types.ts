export interface TallyFieldOption {
  id: string
  text: string
}

export interface TallyField {
  key: string
  label: string
  type: string
  value: unknown
  options?: TallyFieldOption[]
}

export interface TallyWebhookPayload {
  eventId: string
  eventType: string
  createdAt: string
  data: {
    responseId: string
    submissionId: string
    formId: string
    formName: string
    createdAt: string
    fields: TallyField[]
  }
}

export interface TallyApiQuestion {
  id: string
  type: string
  title?: string | null
  fields?: { title?: string | null }[]
}

export interface TallyApiResponse {
  questionId: string
  answer: unknown
}

export interface TallySubmissionListResponse {
  page: number
  limit: number
  total?: number
  hasMore: boolean
  questions?: TallyApiQuestion[]
  submissions: TallySubmissionRecord[]
}

export interface TallySubmissionRecord {
  id: string
  formId: string
  createdAt: string
  submittedAt?: string
  fields?: TallyField[]
  responses?: TallyApiResponse[]
}
