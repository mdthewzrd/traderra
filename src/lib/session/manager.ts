/**
 * Session Manager for Renata AI
 *
 * Manages chat sessions, message history, and provides a unified interface
 * for interacting with the AI agent system.
 *
 * Based on edge-dev implementation adapted for Next.js 15
 */

import { Message } from '../openrouter/client'

export enum SessionStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  ERROR = 'error'
}

export interface SessionMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  timestamp?: string
  metadata?: Record<string, any>
}

export interface ConversationSession {
  sessionId: string
  createdAt: string
  updatedAt: string
  status: SessionStatus
  messages: SessionMessage[]
  metadata: Record<string, any>
}

export interface SessionSummary {
  sessionId: string
  createdAt: string
  updatedAt: string
  status: SessionStatus
  messageCount: number
  metadata: Record<string, any>
}

/**
 * Session Manager Class
 * Manages conversation sessions and maintains history
 */
export class SessionManager {
  private sessions: Map<string, ConversationSession> = new Map()
  private currentSessionId: string | null = null
  private maxSessions: number = 100

  constructor(maxSessions: number = 100) {
    this.maxSessions = maxSessions
  }

  /**
   * Create a new conversation session
   */
  createSession(metadata?: Record<string, any>): string {
    // Enforce max sessions limit
    if (this.sessions.size >= this.maxSessions) {
      this._archiveOldestSession()
    }

    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
    const now = new Date().toISOString()

    const session: ConversationSession = {
      sessionId,
      createdAt: now,
      updatedAt: now,
      status: SessionStatus.ACTIVE,
      messages: [],
      metadata: metadata || {}
    }

    this.sessions.set(sessionId, session)
    this.currentSessionId = sessionId

    console.log(`[SessionManager] Created session: ${sessionId}`)
    return sessionId
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): ConversationSession | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * Get the current active session
   */
  getCurrentSession(): ConversationSession | undefined {
    if (this.currentSessionId) {
      return this.sessions.get(this.currentSessionId)
    }

    // Create session if none exists
    if (this.sessions.size === 0) {
      return this._createSession()
    }

    return undefined
  }

  /**
   * Get or create current session
   */
  getOrCreateCurrentSession(): ConversationSession {
    let session = this.getCurrentSession()

    if (!session) {
      const sessionId = this._createSession()
      session = this.sessions.get(sessionId)!
    }

    return session
  }

  /**
   * Add a message to a session
   */
  addMessage(sessionId: string, role: 'user' | 'assistant', content: string, metadata?: Record<string, any>): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      console.warn(`[SessionManager] Session ${sessionId} not found`)
      return
    }

    const message: SessionMessage = {
      role,
      content,
      timestamp: new Date().toISOString(),
      metadata: metadata || {}
    }

    session.messages.push(message)
    session.updatedAt = new Date().toISOString()
  }

  /**
   * Get recent messages from a session
   */
  getRecentMessages(sessionId: string, count: number = 10): SessionMessage[] {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return []
    }

    return session.messages.slice(-count)
  }

  /**
   * Get all messages from a session as OpenRouter format
   */
  getSessionMessages(sessionId: string): Message[] {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return []
    }

    return session.messages.map(m => ({
      role: m.role,
      content: m.content,
      metadata: m.metadata
    }))
  }

  /**
   * Archive the oldest session when limit is reached
   */
  private _archiveOldestSession(): void {
    const sessionsArray = Array.from(this.sessions.values())
    sessionsArray.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    const oldest = sessionsArray[0]
    if (oldest) {
      oldest.status = SessionStatus.ARCHIVED
      console.log(`[SessionManager] Archived session: ${oldest.sessionId}`)
    }
  }

  /**
   * Clear messages from a session
   */
  clearSession(sessionId?: string): void {
    const id = sessionId || this.currentSessionId
    if (!id) return

    const session = this.sessions.get(id)
    if (session) {
      session.messages = []
      session.updatedAt = new Date().toISOString()
      console.log(`[SessionManager] Cleared messages from session: ${id}`)
    }
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId)
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = null
    }
    console.log(`[SessionManager] Deleted session: ${sessionId}`)
  }

  /**
   * List all sessions
   */
  listSessions(includeArchived: boolean = false): SessionSummary[] {
    const sessionsArray = Array.from(this.sessions.values())

    return sessionsArray
      .filter(s => includeArchived || s.status === SessionStatus.ACTIVE)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map(s => ({
        sessionId: s.sessionId,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        status: s.status,
        messageCount: s.messages.length,
        metadata: s.metadata
      }))
  }

  /**
   * Get manager status
   */
  getStatus(): {
    totalSessions: number
    activeSessions: number
    currentSession: string | null
  } {
    const activeSessions = Array.from(this.sessions.values())
      .filter(s => s.status === SessionStatus.ACTIVE)
      .length

    return {
      totalSessions: this.sessions.size,
      activeSessions,
      currentSession: this.currentSessionId
    }
  }

  /**
   * Clean up old sessions
   */
  cleanupOldSessions(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now()
    const sessionsToDelete: string[] = []

    for (const [id, session] of this.sessions) {
      const sessionAge = now - new Date(session.updatedAt).getTime()
      if (sessionAge > maxAge) {
        sessionsToDelete.push(id)
      }
    }

    for (const id of sessionsToDelete) {
      this.deleteSession(id)
    }

    console.log(`[SessionManager] Cleaned up ${sessionsToDelete.length} old sessions`)
  }

  /**
   * Internal helper to create a session
   */
  private _createSession(): string {
    return this.createSession()
  }
}

/**
 * Singleton instance for easy access
 */
let defaultManager: SessionManager | null = null

/**
 * Get or create default session manager
 */
export function getSessionManager(): SessionManager {
  if (!defaultManager) {
    defaultManager = new SessionManager()
  }
  return defaultManager
}

/**
 * Reset session manager (useful for testing)
 */
export function resetSessionManager(): void {
  defaultManager = null
}
