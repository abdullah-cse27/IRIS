
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
).replace(/\/+$/, '')

export interface IrisDocument {
  id: number
  filename: string
  file_type: string
  file_size: number
  text_char_count: number
  created_at: string | null
}

export interface DocumentListResponse {
  total: number
  documents: IrisDocument[]
}

export interface AskResponse {
  question: string
  answer: string
  sources: {
    document_id: number
    document_name: string
    chunk_id: number
    chunk_index: number
    page_number: number | null
    location: string | null
    text: string
    score: number
  }[]
}

async function apiRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, credentials: 'include' })
  } catch {
    throw new Error(
      'Cannot connect to IRIS backend. Make sure the FastAPI server is running.',
    )
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`

    try {
      const data = await response.json()
      if (typeof data.detail === 'string') {
        message = data.detail
      }
    } catch {
      // Keep the fallback error message.
    }

    throw new Error(message)
  }

  return response.json() as Promise<T>
}

export function getDocuments(): Promise<DocumentListResponse> {
  return apiRequest<DocumentListResponse>('/documents')
}

export function uploadDocument(file: File): Promise<{
  message: string
  id: number
  filename: string
  file_type: string
  file_size: number
  text_char_count: number
}> {
  const formData = new FormData()
  formData.append('file', file)

  return apiRequest('/documents/upload', {
    method: 'POST',
    body: formData,
  })
}

export function deleteDocument(documentId: number): Promise<{
  message: string
  document_id: number
}> {
  return apiRequest(`/documents/${documentId}`, {
    method: 'DELETE',
  })
}

export function askQuestion(
  question: string,
  documentId: number | null = null,
): Promise<AskResponse> {
  return apiRequest<AskResponse>('/ask', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question,
      top_k: 5,
      document_id: documentId,
    }),
  })
}

export interface GeneralChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface GeneralChatResponse {
  answer: string
}

export function chatGeneral(
  question: string,
  history: GeneralChatMessage[] = [],
): Promise<GeneralChatResponse> {
  return apiRequest<GeneralChatResponse>('/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ question, history }),
  })
}

export type AssistantMode = 'documents' | 'smart'


export interface AssistantResponse {
  question: string
  answer: string
  sources: AskResponse['sources']
  web_sources: {
    title: string
    url: string
    content?: string
  }[]
  mode: AssistantMode
  intent?: 'documents' | 'web' | 'general'
}


export function askAssistant(payload: {
  question: string
  history?: GeneralChatMessage[]
  mode: AssistantMode
  web_search_enabled: boolean
  document_id: number | null
}): Promise<AssistantResponse> {
  return apiRequest<AssistantResponse>('/assistant', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question: payload.question,
      history: payload.history ?? [],
      mode: payload.mode,
      web_search_enabled: payload.web_search_enabled,
      document_id: payload.document_id,
      top_k: 5,
    }),
  })
}


export interface AuthUser {
  id: number
  name: string
  phone: string
  email: string
}

export interface AuthMessage { message: string; email?: string }

export function requestSignupOtp(payload: { name: string; phone: string; email: string; password: string }): Promise<AuthMessage> {
  return apiRequest('/auth/signup/request-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
}

export function verifySignupOtp(payload: { email: string; otp: string }): Promise<AuthMessage> {
  return apiRequest('/auth/signup/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
}

export function login(payload: { email: string; password: string }): Promise<AuthMessage & { user: AuthUser }> {
  return apiRequest('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
}

export function getCurrentUser(): Promise<AuthUser> { return apiRequest('/auth/me') }
export function logout(): Promise<AuthMessage> { return apiRequest('/auth/logout', { method: 'POST' }) }

export function updateProfile(payload: { name: string; phone: string }): Promise<AuthUser> {
  return apiRequest('/auth/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
}
export function requestEmailChangeOtp(new_email: string): Promise<AuthMessage> {
  return apiRequest('/auth/email-change/request-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ new_email }) })
}
export function verifyEmailChangeOtp(payload: { new_email: string; otp: string }): Promise<AuthUser> {
  return apiRequest('/auth/email-change/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
}
export function requestPasswordChangeOtp(): Promise<AuthMessage> {
  return apiRequest('/auth/password-change/request-otp', { method: 'POST' })
}
export function verifyPasswordChangeOtp(payload: { otp: string; new_password: string }): Promise<AuthMessage> {
  return apiRequest('/auth/password-change/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
}


export function requestPasswordResetOtp(email: string): Promise<AuthMessage> {
  return apiRequest('/auth/password-reset/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
}

export function verifyPasswordResetOtp(payload: { email: string; otp: string; new_password: string }): Promise<AuthMessage> {
  return apiRequest('/auth/password-reset/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
