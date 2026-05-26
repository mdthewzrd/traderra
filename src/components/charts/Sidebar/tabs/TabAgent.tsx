'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useChartStore } from '@/stores/charts/chartStore'

/**
 * TabAgent — Renata agent chat tab for the charts sidebar.
 *
 * Chat with Renata to build scans, ask about setups, run code.
 * Scan results feed directly into the SCAN tab.
 */

interface ChatMessage {
  id: string
  role: 'user' | 'agent' | 'system'
  content: string
  timestamp: number
  data?: any  // scan results, code, etc.
}

interface ScanResult {
  symbol: string
  date: string
  signal: string
  close: number
  volume: number
  [key: string]: any
}

const STORAGE_KEY = 'traderra-agent-chat'

function loadHistory(): ChatMessage[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch { return [] }
}

function saveHistory(msgs: ChatMessage[]) {
  // Keep last 100 messages
  localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-100)))
}

export function TabAgent() {
  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'chat' | 'scan'>('chat')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const setChartSymbol = useChartStore(s => s.setSymbol)

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Save history on change
  useEffect(() => { saveHistory(messages) }, [messages])

  const addMessage = useCallback((role: ChatMessage['role'], content: string, data?: any) => {
    const msg: ChatMessage = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      role,
      content,
      timestamp: Date.now(),
      data,
    }
    setMessages(prev => [...prev, msg])
    return msg
  }, [])

  // Send scan code to /api/scans/run
  const runScanCode = useCallback(async (code: string, from?: string, to?: string) => {
    const now = new Date()
    const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 3, 1)
    const scanFrom = from || defaultFrom.toISOString().slice(0, 10)
    const scanTo = to || now.toISOString().slice(0, 10)

    try {
      const res = await fetch('/api/scans/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, from: scanFrom, to: scanTo, filterMode: '3', name: 'agent-scan' }),
      })
      const data = await res.json()

      if (data.error) {
        addMessage('system', `❌ Scan error:\n\`\`\`\n${data.error}\n\`\`\``)
        return null
      }

      const signals: ScanResult[] = data.signals || []
      if (signals.length === 0) {
        addMessage('system', 'No signals found in the scan range.')
        return null
      }

      // Store results in localStorage for SCAN tab to pick up
      const scanId = 'scan-' + Date.now()
      const scanDef = {
        id: scanId,
        name: `Agent Scan ${new Date().toLocaleDateString()}`,
        type: 'code',
        results: signals,
        createdAt: Date.now(),
      }

      // Merge into saved scans
      const existingScans = JSON.parse(localStorage.getItem('traderra-scans') || '[]')
      const updated = [...existingScans, scanDef]
      localStorage.setItem('traderra-scans', JSON.stringify(updated))

      addMessage('agent',
        `✅ **${signals.length} signals found.** Results loaded into SCAN tab.\n\nTop results:\n${formatSignalTable(signals.slice(0, 10))}`,
        { scanId, signals }
      )

      return signals
    } catch (err: any) {
      addMessage('system', `❌ Scan execution failed: ${err.message}`)
      return null
    }
  }, [addMessage])

  // Send message to agent
  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    addMessage('user', text)
    setLoading(true)

    try {
      const res = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          mode: 'renata',
          agent: 'renata',
          context: { currentPage: 'charts' },
        }),
      })
      const data = await res.json()

      if (data.success) {
        addMessage('agent', data.response, data.data)

        // Check if agent returned scan code
        if (data.data?.scanCode) {
          await runScanCode(data.data.scanCode, data.data.from, data.data.to)
        }
      } else {
        addMessage('system', data.message || 'Agent request failed. Try again.')
      }
    } catch (err: any) {
      addMessage('system', `❌ Connection error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [input, loading, addMessage, runScanCode])

  // Quick actions
  const quickActions = [
    { label: '📈 Scan backside B', prompt: 'Run a backside B scan for the last 3 months. Use the V31 gold standard methodology.' },
    { label: '📊 Scan gap ups', prompt: 'Run a gap up scan for today. Look for stocks gapping up > 2x ATR with volume confirmation.' },
    { label: '🔍 Scan FBO', prompt: 'Run a fade-breakout (FBO) scan for the last month. Look for failed breakouts at significant levels.' },
    { label: '📚 Explain setup', prompt: 'Explain the backside B setup. What are the key features, entry conditions, and how does the V31 methodology work?' },
  ]

  const handleQuickAction = useCallback((prompt: string) => {
    setInput(prompt)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }, [sendMessage])

  // Render message content with basic markdown
  const renderContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      // Bold
      let rendered = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Code blocks inline
      rendered = rendered.replace(/`([^`]+)`/g, '<code style="background:#0d1220;padding:1px 4px;border-radius:2px;font-size:10px;">$1</code>')

      if (rendered.startsWith('```')) {
        return <div key={i} style={{ background: '#0a0c12', padding: '6px 8px', borderRadius: 3, fontSize: 10, fontFamily: 'monospace', color: '#8aa0c0', margin: '2px 0', whiteSpace: 'pre-wrap', overflowX: 'auto' }}>{rendered.replace(/```/g, '')}</div>
      }

      return <div key={i} dangerouslySetInnerHTML={{ __html: rendered || '&nbsp;' }} style={{ lineHeight: 1.4 }} />
    })
  }

  return (
    <div id="tab-agent">
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid #111620' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#a855f7', letterSpacing: 1 }}>🤖 RENATA</span>
        <span style={{ marginLeft: 8, fontSize: 10, color: loading ? '#fbbf24' : '#4a6080' }}>
          {loading ? 'thinking...' : 'ready'}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#4a6080', cursor: 'pointer' }}
          onClick={() => { setMessages([]); localStorage.removeItem(STORAGE_KEY) }}>
          🗑
        </span>
      </div>

      {/* Quick actions */}
      {messages.length === 0 && (
        <div style={{ padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: '#4a6080', fontWeight: 700, marginBottom: 6 }}>QUICK ACTIONS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {quickActions.map((a, i) => (
              <button key={i} onClick={() => handleQuickAction(a.prompt)} style={{
                background: '#1a1030', border: '1px solid #2a2040', color: '#c084fc',
                fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 3, cursor: 'pointer',
              }}>
                {a.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#3a4560', marginTop: 10, lineHeight: 1.5 }}>
            Ask Renata to build scans, explain setups, or run code.
            <br />Results load directly into the SCAN tab.
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
        {messages.map(msg => (
          <div key={msg.id} style={{
            marginBottom: 8,
            padding: '6px 8px',
            borderRadius: 4,
            background: msg.role === 'user' ? '#1a1e2a' : msg.role === 'system' ? '#1a1020' : '#0d1220',
            borderLeft: msg.role === 'user' ? '2px solid #4a6080' : msg.role === 'system' ? '2px solid #fbbf24' : '2px solid #a855f7',
          }}>
            <div style={{ fontSize: 9, color: '#4a6080', marginBottom: 2, fontWeight: 700 }}>
              {msg.role === 'user' ? 'YOU' : msg.role === 'system' ? 'SYSTEM' : 'RENATA'}
              <span style={{ fontWeight: 400, marginLeft: 6 }}>{new Date(msg.timestamp).toLocaleTimeString()}</span>
            </div>
            <div style={{ fontSize: 11, color: '#dde3f0' }}>
              {renderContent(msg.content)}
            </div>

            {/* Signal data — clickable symbols */}
            {msg.data?.signals && msg.data.signals.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {msg.data.signals.slice(0, 20).map((s: ScanResult, i: number) => (
                  <button key={i} onClick={() => {
                    setChartSymbol(s.symbol)
                    ;(window as any).symbol = s.symbol
                    ;(window as any).loadChart?.(s.symbol)
                  }} style={{
                    background: '#1a1e2a', border: '1px solid #2a3050', color: '#4ade80',
                    fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3, cursor: 'pointer',
                  }}>
                    {s.symbol}
                  </button>
                ))}
                {msg.data.signals.length > 20 && (
                  <span style={{ fontSize: 10, color: '#4a6080' }}>+{msg.data.signals.length - 20} more</span>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ padding: '6px 8px', color: '#a855f7', fontSize: 11 }}>
            <span style={{ animation: 'pulse 1.5s infinite' }}>●</span> Renata is thinking...
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid #111620' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Renata..."
            rows={2}
            style={{
              flex: 1, background: '#0a0c12', border: '1px solid #2a3050', color: '#dde3f0',
              fontSize: 11, padding: '6px 8px', borderRadius: 4, resize: 'none', outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            style={{
              background: loading ? '#1a1030' : '#a855f7', border: 'none', color: loading ? '#4a6080' : '#fff',
              fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 4, cursor: loading ? 'default' : 'pointer',
              alignSelf: 'flex-end',
            }}
          >
            {loading ? '...' : '→'}
          </button>
        </div>
      </div>
    </div>
    </div>
  )
}

function formatSignalTable(signals: ScanResult[]): string {
  if (!signals.length) return ''
  const rows = signals.map(s =>
    `| ${s.symbol.padEnd(6)} | ${(s.date || '').padEnd(10)} | ${(s.signal || '').padEnd(8)} | ${s.close.toFixed(2).padStart(8)} |`
  )
  return `| Symbol | Date       | Signal   | Close    |\n|--------|------------|----------|----------|\n${rows.join('\n')}`
}
