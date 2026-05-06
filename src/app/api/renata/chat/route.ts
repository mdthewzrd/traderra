import { NextRequest, NextResponse } from 'next/server'

// Dynamic mode detection - analyze user message to determine appropriate mode
function detectOptimalMode(userMessage: string): 'renata' | 'coach' | 'analyst' | 'mentor' {
  const messageLower = userMessage.toLowerCase();

  // Coach mode - wants improvement, feedback, coaching
  const coachKeywords = [
    'improve', 'better', 'feedback', 'how can i', 'what should i', 'coach me',
    'help me get better', 'review my', 'critique', 'suggestions', 'advice on'
  ];

  // Analyst mode - wants data, analysis, statistics
  const analystKeywords = [
    'analyze', 'analysis', 'data', 'statistics', 'stats', 'performance', 'metrics',
    'numbers', 'breakdown', 'show me', 'what are my', 'how well', 'win rate',
    'profit', 'loss', 'expectancy', 'sharpe ratio', 'drawdown'
  ];

  // Mentor mode - wants guidance, wisdom, long-term perspective
  const mentorKeywords = [
    'mentor', 'guidance', 'wisdom', 'long term', 'career', 'journey', 'experience',
    'teach me', 'learning path', 'what should i focus on', 'future', 'goals'
  ];

  // Check for analyst mode first (most specific)
  if (analystKeywords.some(keyword => messageLower.includes(keyword))) {
    return 'analyst';
  }

  // Check for coach mode
  if (coachKeywords.some(keyword => messageLower.includes(keyword))) {
    return 'coach';
  }

  // Check for mentor mode
  if (mentorKeywords.some(keyword => messageLower.includes(keyword))) {
    return 'mentor';
  }

  // Default to renata for conversational messages
  return 'renata';
}

// Filter function to make responses more conversational and less stats-focused
function filterRenataResponse(originalMessage: string, backendResponse: string): string {
  // Only catch very specific, generic stats-heavy patterns
  const responseLower = backendResponse.toLowerCase()
  const messageLower = originalMessage.toLowerCase()

  // Check for specific problematic patterns from the backend
  const problematicPatterns = [
    /hello.*ready to work on improving your trading.*\d+\.?\d*%.*win rate/i,
    /your recent.*\d+\.?\d*%.*win rate.*shows/i,
    /ready to work on improving.*\d+\.?\d*%.*win rate/i,
    /strong performance this period.*\d+\.?\d*%.*win rate.*\d+\.?\d*r.*expectancy/i,
    /focus on maintaining consistency.*process.*recent performance/i
  ]

  // Check for emotional/conversational messages that shouldn't get stats
  const isEmotionalOrConversational = [
    'bad trade', 'loss', 'losing', 'frustrated', 'happy with', 'excited about',
    'how are you', 'how\'s it going', 'what\'s up', 'thanks', 'awesome', 'terrible'
  ].some(keyword => messageLower.includes(keyword));

  // If it's an emotional message but the response is stats-heavy, filter it
  if (isEmotionalOrConversational && (
    responseLower.includes('win rate') ||
    responseLower.includes('expectancy') ||
    responseLower.includes('performance') ||
    responseLower.includes('consistency') ||
    responseLower.includes('execution')
  )) {
    // Generate empathetic, contextual responses
    if (messageLower.includes('bad trade') || messageLower.includes('loss') || messageLower.includes('losing')) {
      return "I'm sorry to hear about that. Trading can be challenging, and losses are part of the journey. Would you like to talk about what happened or discuss some strategies for moving forward?";
    } else if (messageLower.includes('frustrated')) {
      return "I understand that frustration. Trading has its ups and downs. Sometimes taking a step back can help. What's been particularly challenging lately?";
    } else if (messageLower.includes('happy') || messageLower.includes('excited')) {
      return "That's great to hear! It sounds like you've had some positive trading experiences. What's working well for you right now?";
    } else {
      return "I hear you. Trading can definitely be an emotional journey. I'm here to chat about whatever's on your mind - trading related or not. What would help right now?";
    }
  }

  // Check if it matches other problematic patterns
  for (const pattern of problematicPatterns) {
    if (pattern.test(backendResponse)) {
      // Generate contextual responses based on the original message
      if (messageLower.includes('hello') || messageLower.includes('hey') || messageLower.includes('hi')) {
        return "Hi there! How are you today? I'm here to chat about anything trading-related or just to have a conversation. What's on your mind?"
      } else if (messageLower.includes('how are you') || messageLower.includes("how's it going")) {
        return "I'm doing great, thanks for asking! I'm excited to chat with you about trading or whatever else you'd like to discuss. How are you doing?";
      } else if (messageLower.includes('help') || messageLower.includes('can you')) {
        return "Absolutely! I'd be happy to help. What specifically would you like to talk about or work on today?";
      } else if (messageLower.includes('strategy') || messageLower.includes('strategies')) {
        return "I love talking about trading strategies! What aspect are you interested in? Risk management, entry/exit points, position sizing, or something else?";
      } else {
        return "Hello! I'm Renata, your AI assistant. I'm here to help with trading insights, strategy discussions, market analysis, or just chat. What would you like to explore?"
      }
    }
  }

  // Return the original response for everything else
  return backendResponse
}

// Enhanced Renata chat API - Connects to backend AI with CopilotKit integration
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Handle both single message and messages array formats
    let message: string
    if (body.message) {
      message = body.message
    } else if (body.messages && body.messages.length > 0) {
      const lastMessage = body.messages[body.messages.length - 1]
      message = lastMessage.content || ''
    } else {
      message = ''
    }

    const { mode = 'renata', context, smartAnalysis, concise, systemInstructions, attachedFile, userId } = body

    // Check if concise mode is requested (default true for brevity)
    const conciseMode = concise !== false
    const customInstructions = systemInstructions || ''

    // Handle file upload if attached
    if (attachedFile && attachedFile.name && attachedFile.content) {
      console.log('File attached:', attachedFile.name)

      try {
        // Decode base64 content to analyze the CSV
        const base64Content = attachedFile.content
        const csvBytes = Buffer.from(base64Content, 'base64')
        const csvText = csvBytes.toString('utf-8-sig')

        // Parse CSV to get basic info
        const lines = csvText.split('\n').filter(line => line.trim())
        const headerLine = lines[0] || ''
        const tradeCount = Math.max(0, lines.length - 1) // Subtract header row

        // Extract column names from header
        const columns = headerLine.split(',').map(col => col.trim())

        // Add file info to the message for AI to acknowledge
        const fileInfo = `\n\n[📎 FILE UPLOADED: ${attachedFile.name}]
- Type: CSV file with ${tradeCount} trade(s)
- Columns: ${columns.slice(0, 5).join(', ')}${columns.length > 5 ? '...' : ''}
- Status: File received and ready for import`

        // Append file info to message
        message = message + fileInfo

        console.log('File info added to message:', { fileName: attachedFile.name, tradeCount })
      } catch (error) {
        console.error('Error processing file:', error)

        const errorMessage = `\n\n[❌ FILE UPLOAD ERROR: ${attachedFile.name}]
${error instanceof Error ? error.message : 'Failed to process file'}`

        message = message + errorMessage
      }
    }

    // Dynamic mode detection - analyze the message to determine optimal mode
    const optimalMode = detectOptimalMode(message)
    const effectiveMode = (mode === 'renata' && optimalMode !== 'renata') ? optimalMode : mode

    console.log('🔄 Renata Chat API - Forwarding to backend AI')
    console.log('📝 Message:', message)
    console.log('🎯 User selected mode:', mode)
    console.log('🧠 Detected optimal mode:', optimalMode)
    console.log('⚡ Effective mode being used:', effectiveMode)
    console.log('🔧 Context:', context)
    console.log('✨ Concise mode:', conciseMode)
    console.log('📜 Custom instructions:', customInstructions ? 'Yes' : 'No')

    // For Renata mode, add conversational guidance
    if (effectiveMode === 'renata') {
      console.log('🤖 Renata mode detected - using conversational style')
    }

    try {
      // Forward to backend AI endpoint for intelligent processing
      const backendResponse = await fetch('http://localhost:6500/ai/conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          mode: effectiveMode,
          ui_context: {
            ...context,
            currentPage: context?.page || 'dashboard',
            timestamp: new Date().toISOString()
          },
          conversation_history: [], // Could be enhanced with session history
          context: {
            userPreferences: {
              ai_mode: effectiveMode,
              verbosity: conciseMode ? "concise" : "normal",
              stats_basis: effectiveMode === 'renata' ? null : "gross", // No stats basis for renata mode
              unit_mode: effectiveMode === 'renata' ? null : (context?.displayMode || "dollar"), // No unit mode for renata
              conversation_style: effectiveMode === 'renata' ? 'conversational' : 'analytical', // Renata is conversational
              avoid_auto_stats: effectiveMode === 'renata' ? true : false, // Explicitly avoid auto stats for renata
              system_instructions: customInstructions // Pass custom instructions to backend
            }
          }
        })
      })

      if (!backendResponse.ok) {
        console.error('❌ Backend AI error:', backendResponse.status, backendResponse.statusText)
        throw new Error(`Backend AI returned ${backendResponse.status}: ${backendResponse.statusText}`)
      }

      const aiResponse = await backendResponse.json()
      console.log('✅ Backend AI response:', aiResponse)

      // Process any UI actions from the backend response
      if (aiResponse.ui_action) {
        console.log('🎯 UI Action detected:', aiResponse.ui_action)
      }

      // Filter response for Renata mode to be less stats-focused
      let filteredResponse = aiResponse.response
      if (effectiveMode === 'renata') {
        filteredResponse = filterRenataResponse(message, aiResponse.response)
        if (filteredResponse !== aiResponse.response) {
          console.log('🔄 Renata response filtered for conversational style')
          console.log('📝 Original:', aiResponse.response)
          console.log('📝 Filtered:', filteredResponse)
        } else {
          console.log('✅ Renata response passed through (no filtering needed)')
        }
      }

      // Return the enhanced response from the backend
      return NextResponse.json({
        response: filteredResponse,
        mode_used: effectiveMode,
        original_mode: mode,
        optimal_mode: optimalMode,
        mode_switched: optimalMode !== mode && mode === 'renata',
        timestamp: aiResponse.timestamp || new Date().toISOString(),
        command_type: aiResponse.command_type,
        intent: aiResponse.intent,
        confidence: aiResponse.confidence,
        ui_action: aiResponse.ui_action,
        ai_mode_change: aiResponse.ai_mode_change,
        learning_applied: aiResponse.learning_applied || false,
        navigationCommands: aiResponse.ui_action ? [aiResponse.ui_action] : [],
        nlpAnalysis: {
          dateRange: null,
          intents: [aiResponse.intent] || [],
          advancedParams: aiResponse.ui_action?.parameters || {}
        }
      })

    } catch (backendError) {
      console.error('❌ Backend connection error:', backendError)

      // Fallback to basic response if backend is unavailable
      return NextResponse.json({
        response: "I'm having trouble connecting to my AI backend right now. Please try again in a moment.",
        mode_used: effectiveMode,
        original_mode: mode,
        optimal_mode: optimalMode,
        mode_switched: optimalMode !== mode && mode === 'renata',
        timestamp: new Date().toISOString(),
        command_type: "error",
        intent: "backend_error",
        confidence: 0.0,
        error: backendError instanceof Error ? backendError.message : 'Unknown backend error',
        navigationCommands: [],
        nlpAnalysis: null
      }, { status: 503 })
    }

  } catch (error) {
    console.error('❌ Renata Chat API error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      message: 'I apologize, but I encountered an internal error. Please try again in a moment.',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}