/**
 * AG-UI Chat Service
 *
 * Service for communicating with the backend AG-UI chat endpoint
 * and executing frontend tool calls.
 */

export interface AGUIToolCall {
  tool: string
  args: Record<string, any>
  result?: {
    success: boolean
    [key: string]: any
  }
}

export interface AGUIChatResponse {
  response: string
  tool_calls: AGUIToolCall[]
  timestamp: string
}

export interface AGUIChatRequest {
  message: string
  context?: {
    currentPage?: string
    dateRange?: string
    displayMode?: string
    pnlMode?: string
    accountSize?: number
  }
}

/**
 * Send chat message to backend AG-UI endpoint
 * Returns the response with tool calls that should be executed
 */
export async function sendAGUIChatMessage(
  request: AGUIChatRequest
): Promise<AGUIChatResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6500'
  const url = `${baseUrl}/agui/chat`

  console.log('[AG-UI] Sending chat message:', request.message)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error(`AG-UI chat failed: ${response.status} ${response.statusText}`)
  }

  const data: AGUIChatResponse = await response.json()
  console.log('[AG-UI] Received response:', data)

  return data
}

/**
 * Get current UI context for sending to backend
 */
export function getCurrentUIContext(): AGUIChatRequest['context'] {
  if (typeof window === 'undefined') {
    return {}
  }

  const pathname = window.location.pathname
  const currentPage = pathname.replace(/^\//, '') || 'dashboard'

  // Try to get context from localStorage if available
  const dateRange = localStorage.getItem('dateRange') || '90d'
  const displayMode = localStorage.getItem('displayMode') || 'dollar'
  const pnlMode = localStorage.getItem('pnlMode') || 'net'
  const accountSize = parseInt(localStorage.getItem('accountSize') || '50000', 10)

  return {
    currentPage,
    dateRange,
    displayMode,
    pnlMode,
    accountSize,
  }
}

/**
 * Hook for using AG-UI chat in components
 * This combines the chat service with tool execution
 */
export function createAGUIChatHandler(executeTool: (tool: string, args: any) => Promise<any>) {
  return {
    sendMessage: async (
      message: string,
      context?: AGUIChatRequest['context']
    ): Promise<AGUIChatResponse> => {
      const uiContext = context || getCurrentUIContext()
      const response = await sendAGUIChatMessage({ message, context: uiContext })

      // Execute any tool calls returned by the backend
      if (response.tool_calls && response.tool_calls.length > 0) {
        console.log(`[AG-UI] Executing ${response.tool_calls.length} tool calls`)

        for (const toolCall of response.tool_calls) {
          const { tool, args } = toolCall

          try {
            console.log(`[AG-UI] Executing tool: ${tool}`, args)
            const result = await executeTool(tool, args)

            if (result.success) {
              console.log(`[AG-UI] Tool ${tool} executed successfully:`, result.message)
            } else {
              console.error(`[AG-UI] Tool ${tool} failed:`, result.error)
            }
          } catch (error) {
            console.error(`[AG-UI] Error executing tool ${tool}:`, error)
          }
        }
      }

      return response
    }
  }
}
