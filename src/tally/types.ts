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

export interface TallySubmissionListResponse {
  page: number
  limit: number
  total: number
  hasMore: boolean
  submissions: TallySubmissionRecord[]
}

export interface TallySubmissionRecord {
  id: string
  formId: string
  createdAt: string
  fields: TallyField[]
}
