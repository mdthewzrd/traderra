import { NextRequest, NextResponse } from 'next/server'

interface Workflow {
  id: string
  name: string
  description: string
  status: 'draft' | 'active' | 'paused' | 'completed' | 'error'
  triggers: string[]
  steps: WorkflowStep[]
  schedule?: string
  lastRun?: string
  nextRun?: string
  performance?: {
    totalRuns: number
    successRate: number
    avgExecutionTime: number
    lastResult: any
  }
}

interface WorkflowStep {
  id: string
  type: 'scanner' | 'analyzer' | 'backtest' | 'signal' | 'risk_check' | 'execution'
  name: string
  config: Record<string, any>
  condition?: string
  order: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: any
  error?: string
}

// Mock workflows for demonstration
const mockWorkflows: Workflow[] = [
  {
    id: 'momentum-breakthrough',
    name: 'Momentum Breakthrough Scanner',
    description: 'Identifies high-momentum stocks and validates with risk management',
    status: 'active',
    triggers: ['schedule', 'market_open'],
    steps: [
      {
        id: 'step1',
        type: 'scanner',
        name: 'Momentum Scan',
        config: {
          indicators: ['RSI', 'MACD', 'Volume'],
          minChange: 5,
          timeframe: '1D',
          universe: ['SPY', 'QQQ', 'large_cap_stocks']
        },
        order: 1,
        status: 'completed'
      },
      {
        id: 'step2',
        type: 'risk_check',
        name: 'Risk Validation',
        config: {
          maxPositionSize: 10000,
          maxPortfolioExposure: 0.05
        },
        condition: 'step1.results.length > 0',
        order: 2,
        status: 'completed'
      },
      {
        id: 'step3',
        type: 'signal',
        name: 'Generate Signals',
        config: {
          signalType: 'buy',
          confidence: 0.8
        },
        condition: 'step2.approved == true',
        order: 3,
        status: 'completed'
      }
    ],
    schedule: '0 9,16 * * 1-5', // 9 AM and 4 PM on weekdays
    lastRun: '2024-12-01T16:00:00Z',
    nextRun: '2024-12-02T09:00:00Z',
    performance: {
      totalRuns: 45,
      successRate: 0.93,
      avgExecutionTime: 12.5,
      lastResult: {
        signalsGenerated: 8,
        riskPassed: 6,
        executed: 4
      }
    }
  },
  {
    id: 'portfolio-rebalance',
    name: 'Portfolio Rebalancing',
    description: 'Weekly portfolio analysis and rebalancing based on performance',
    status: 'draft',
    triggers: ['schedule'],
    steps: [
      {
        id: 'step1',
        type: 'analyzer',
        name: 'Performance Analysis',
        config: {
          period: '1w',
          metrics: ['returns', 'risk', 'correlation']
        },
        order: 1,
        status: 'pending'
      },
      {
        id: 'step2',
        type: 'backtest',
        name: 'Rebalancing Simulation',
        config: {
          rebalanceFrequency: 'weekly',
          threshold: 0.05
        },
        order: 2,
        status: 'pending'
      }
    ],
    schedule: '0 10 * * 1', // 10 AM every Monday
    performance: undefined
  }
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workflowId = searchParams.get('id')
    const status = searchParams.get('status')

    if (workflowId) {
      const workflow = mockWorkflows.find(w => w.id === workflowId)
      if (!workflow) {
        return NextResponse.json(
          { error: 'Workflow not found' },
          { status: 404 }
        )
      }
      return NextResponse.json({ workflow })
    }

    if (status) {
      const filteredWorkflows = mockWorkflows.filter(w => w.status === status)
      return NextResponse.json({ workflows: filteredWorkflows })
    }

    return NextResponse.json({
      workflows: mockWorkflows,
      summary: {
        total: mockWorkflows.length,
        active: mockWorkflows.filter(w => w.status === 'active').length,
        draft: mockWorkflows.filter(w => w.status === 'draft').length,
        paused: mockWorkflows.filter(w => w.status === 'paused').length
      }
    })
  } catch (error) {
    console.error('Error fetching workflows:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workflows' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, data } = body

    switch (action) {
      case 'create':
        const newWorkflow: Workflow = {
          id: `workflow-${Date.now()}`,
          name: data.name,
          description: data.description || '',
          status: 'draft',
          triggers: data.triggers || ['manual'],
          steps: data.steps || [],
          schedule: data.schedule,
          performance: undefined
        }

        mockWorkflows.push(newWorkflow)
        return NextResponse.json({ workflow: newWorkflow })

      case 'execute':
        const { workflowId, params } = data
        const workflow = mockWorkflows.find(w => w.id === workflowId)

        if (!workflow) {
          return NextResponse.json(
            { error: 'Workflow not found' },
            { status: 404 }
          )
        }

        // Simulate workflow execution
        const executionId = `exec-${Date.now()}`

        // Start execution
        workflow.status = 'running'
        workflow.lastRun = new Date().toISOString()

        // Simulate step-by-step execution
        executeWorkflowSteps(workflow, executionId)

        return NextResponse.json({
          executionId,
          workflow: workflow.id,
          status: 'started'
        })

      case 'update':
        const { workflowId: updateId, updates } = data
        const workflowToUpdate = mockWorkflows.find(w => w.id === updateId)

        if (!workflowToUpdate) {
          return NextResponse.json(
            { error: 'Workflow not found' },
            { status: 404 }
          )
        }

        Object.assign(workflowToUpdate, updates)
        return NextResponse.json({ workflow: workflowToUpdate })

      case 'duplicate':
        const { workflowId: dupId } = data
        const workflowToDuplicate = mockWorkflows.find(w => w.id === dupId)

        if (!workflowToDuplicate) {
          return NextResponse.json(
            { error: 'Workflow not found' },
            { status: 404 }
          )
        }

        const duplicatedWorkflow: Workflow = {
          ...workflowToDuplicate,
          id: `${workflowToDuplicate.id}-copy-${Date.now()}`,
          name: `${workflowToDuplicate.name} (Copy)`,
          status: 'draft',
          lastRun: undefined,
          nextRun: undefined,
          performance: undefined
        }

        mockWorkflows.push(duplicatedWorkflow)
        return NextResponse.json({ workflow: duplicatedWorkflow })

      case 'delete':
        const { workflowId: deleteId } = data
        const index = mockWorkflows.findIndex(w => w.id === deleteId)

        if (index === -1) {
          return NextResponse.json(
            { error: 'Workflow not found' },
            { status: 404 }
          )
        }

        const deletedWorkflow = mockWorkflows.splice(index, 1)[0]
        return NextResponse.json({ workflow: deletedWorkflow })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error managing workflow:', error)
    return NextResponse.json(
      { error: 'Failed to manage workflow' },
      { status: 500 }
    )
  }
}

async function executeWorkflowSteps(workflow: Workflow, executionId: string) {
  const steps = workflow.steps.sort((a, b) => a.order - b.order)

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]

    try {
      step.status = 'running'

      // Simulate step execution time
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000))

      // Generate mock result based on step type
      const mockResult = generateStepResult(step)
      step.result = mockResult
      step.status = 'completed'

    } catch (error) {
      step.status = 'failed'
      step.error = error instanceof Error ? error.message : 'Unknown error'
      workflow.status = 'error'
      break
    }
  }

  // Update workflow status based on step results
  const allCompleted = steps.every(step => step.status === 'completed')
  const anyFailed = steps.some(step => step.status === 'failed')

  if (allCompleted) {
    workflow.status = 'completed'
    if (!workflow.performance) {
      workflow.performance = {
        totalRuns: 0,
        successRate: 0,
        avgExecutionTime: 0,
        lastResult: {}
      }
    }
    workflow.performance.totalRuns += 1
    workflow.performance.lastResult = steps.reduce((acc, step) => {
      acc[step.name] = step.result
      return acc
    }, {} as Record<string, any>)
  } else if (anyFailed) {
    workflow.status = 'error'
  }
}

function generateStepResult(step: WorkflowStep): any {
  switch (step.type) {
    case 'scanner':
      return {
        scannedSymbols: 150,
        matchesFound: 12,
        topSignals: [
          { symbol: 'AAPL', score: 8.5, change: 6.2 },
          { symbol: 'MSFT', score: 7.8, change: 4.8 },
          { symbol: 'GOOGL', score: 7.2, change: 5.1 }
        ],
        executionTime: 3.2
      }

    case 'risk_check':
      return {
        approved: true,
        riskScore: 6.5,
        warnings: [],
        maxPositionSize: 10000,
        portfolioImpact: 0.03
      }

    case 'signal':
      return {
        signalsGenerated: 8,
        buySignals: 5,
        sellSignals: 3,
        avgConfidence: 0.78,
        highConfidenceSignals: 3
      }

    case 'backtest':
      return {
        sharpeRatio: 1.45,
        maxDrawdown: 12.3,
        totalReturn: 18.7,
        winRate: 0.62,
        numTrades: 156
      }

    case 'analyzer':
      return {
        portfolioValue: 125000,
        totalReturn: 12.5,
        riskMetrics: {
          var95: 2500,
          beta: 1.15,
          sharpeRatio: 1.8
        },
        recommendations: ['Increase diversification', 'Reduce tech exposure']
      }

    default:
      return {
        status: 'completed',
        message: 'Step executed successfully'
      }
  }
}