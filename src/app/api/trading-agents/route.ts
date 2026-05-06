import { NextRequest, NextResponse } from 'next/server'

// In-memory storage for demo purposes
// In production, this would be a database
let agents: any[] = [
  {
    id: 'momentum-scanner',
    name: 'Momentum Scanner',
    type: 'scanner',
    status: 'idle',
    description: 'Scans for momentum breakout patterns across large-cap stocks',
    performance: {
      sharpeRatio: 1.8,
      maxDrawdown: 12.5,
      winRate: 0.65,
      totalReturn: 24.3
    },
    lastRun: '2024-12-01 14:30:00',
    parameters: {
      lookback: 20,
      threshold: 2.0,
      volumeMultiplier: 1.5
    }
  },
  {
    id: 'mean-reversion-backtester',
    name: 'Mean Reversion Backtester',
    type: 'backtester',
    status: 'completed',
    description: 'Backtests mean reversion strategies with statistical validation',
    performance: {
      sharpeRatio: 1.2,
      maxDrawdown: 8.3,
      winRate: 0.58,
      totalReturn: 18.7
    },
    lastRun: '2024-12-01 16:45:00',
    parameters: {
      lookbackPeriod: 60,
      entryThreshold: 2.0,
      exitThreshold: 0.5,
      stopLoss: 0.15
    }
  }
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('id')
    const type = searchParams.get('type')

    if (agentId) {
      const agent = agents.find(a => a.id === agentId)
      if (!agent) {
        return NextResponse.json(
          { error: 'Agent not found' },
          { status: 404 }
        )
      }
      return NextResponse.json({ agent })
    }

    if (type) {
      const filteredAgents = agents.filter(a => a.type === type)
      return NextResponse.json({ agents: filteredAgents })
    }

    return NextResponse.json({ agents })
  } catch (error) {
    console.error('Error fetching agents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, agentId, agentData } = body

    switch (action) {
      case 'create':
        const newAgent = {
          id: `agent-${Date.now()}`,
          ...agentData,
          status: 'idle',
          createdAt: new Date().toISOString()
        }
        agents.push(newAgent)
        return NextResponse.json({ agent: newAgent })

      case 'run':
        const agentToRun = agents.find(a => a.id === agentId)
        if (!agentToRun) {
          return NextResponse.json(
            { error: 'Agent not found' },
            { status: 404 }
          )
        }
        agentToRun.status = 'running'

        // Simulate agent execution
        setTimeout(() => {
          const agent = agents.find(a => a.id === agentId)
          if (agent) {
            agent.status = 'completed'
            agent.lastRun = new Date().toLocaleString()
            if (agent.performance) {
              agent.performance.totalReturn += Math.random() * 10 - 2
            }
          }
        }, 3000 + Math.random() * 4000)

        return NextResponse.json({ agent: agentToRun })

      case 'stop':
        const agentToStop = agents.find(a => a.id === agentId)
        if (!agentToStop) {
          return NextResponse.json(
            { error: 'Agent not found' },
            { status: 404 }
          )
        }
        agentToStop.status = 'idle'
        return NextResponse.json({ agent: agentToStop })

      case 'delete':
        const index = agents.findIndex(a => a.id === agentId)
        if (index === -1) {
          return NextResponse.json(
            { error: 'Agent not found' },
            { status: 404 }
          )
        }
        const deletedAgent = agents.splice(index, 1)[0]
        return NextResponse.json({ agent: deletedAgent })

      case 'duplicate':
        const agentToDuplicate = agents.find(a => a.id === agentId)
        if (!agentToDuplicate) {
          return NextResponse.json(
            { error: 'Agent not found' },
            { status: 404 }
          )
        }
        const duplicatedAgent = {
          ...agentToDuplicate,
          id: `${agentToDuplicate.id}-copy-${Date.now()}`,
          name: `${agentToDuplicate.name} (Copy)`,
          status: 'idle',
          lastRun: undefined,
          createdAt: new Date().toISOString()
        }
        agents.push(duplicatedAgent)
        return NextResponse.json({ agent: duplicatedAgent })

      case 'update':
        const agentToUpdate = agents.find(a => a.id === agentId)
        if (!agentToUpdate) {
          return NextResponse.json(
            { error: 'Agent not found' },
            { status: 404 }
          )
        }
        Object.assign(agentToUpdate, agentData)
        return NextResponse.json({ agent: agentToUpdate })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error managing agent:', error)
    return NextResponse.json(
      { error: 'Failed to manage agent' },
      { status: 500 }
    )
  }
}