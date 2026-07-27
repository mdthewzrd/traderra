// Minimal type surface for the AG-UI API client (src/lib/api.ts).
// Backend contract is loose/evolving; kept permissive to avoid blocking consumers.

export interface AguiComponent {
  id?: string
  type?: string
  [key: string]: any
}

export interface AguiResponse {
  components?: AguiComponent[]
  [key: string]: any
}

export interface AguiGenerationRequest {
  [key: string]: any
}
