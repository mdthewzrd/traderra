'use client'

import { useState, useEffect } from 'react'
import {
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Star,
  Tag,
  Edit,
  Trash2,
  Plus,
  Search,
  Filter,
  BookOpen,
  Target,
  AlertCircle,
  CheckCircle,
  X,
  FileText,
  BarChart3,
  Clock3,
  Calculator,
  Lightbulb,
  Shield,
  Type,
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3
} from 'lucide-react'
import { cn } from '@/lib/utils'

// BlockNote import
import { BlockNoteEditor } from './BlockNoteEditor'

// TipTap imports (keeping for reference but using BlockNote now)
// import { useEditor, EditorContent } from '@tiptap/react'
// import StarterKit from '@tiptap/starter-kit'
// import Heading from '@tiptap/extension-heading'
// import Placeholder from '@tiptap/extension-placeholder'

// Utility function to convert markdown to HTML
function markdownToHtml(markdown: string): string {
  if (!markdown) return ''

  return markdown
    // Convert bold text **text** to <strong>text</strong>
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Convert italic text *text* to <em>text</em>
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Convert line breaks to <br> and wrap paragraphs
    .split('\n\n')
    .map(paragraph => {
      if (paragraph.trim() === '') return ''
      // Handle lists that start with -
      if (paragraph.includes('\n- ')) {
        const lines = paragraph.split('\n')
        const firstLine = lines[0]
        const listItems = lines.slice(1)
          .filter(line => line.trim().startsWith('- '))
          .map(line => `<li>${line.replace(/^- /, '')}</li>`)
          .join('')
        return firstLine ? `<p>${firstLine}</p><ul>${listItems}</ul>` : `<ul>${listItems}</ul>`
      }
      // Regular paragraph
      return `<p>${paragraph.replace(/\n/g, '<br>')}</p>`
    })
    .join('')
}

// Mock journal entries data
const mockJournalEntries = [
  {
    id: '1',
    date: '2024-01-29',
    title: 'Strong Momentum Play on YIBO',
    strategy: 'Momentum Breakout',
    side: 'Long',
    setup: 'Breakout above resistance',
    bias: 'Long',
    pnl: 531.20,
    rating: 5,
    tags: ['momentum', 'breakout', 'pre-market'],
    content: `<p>Perfect setup today on YIBO. Stock showed strong pre-market activity with heavy volume. Entered on the breakout above $49.80 resistance level.</p>

<p><strong>Setup Analysis:</strong></p>
<ul>
<li>Pre-market volume 3x normal</li>
<li>Clean breakout above resistance</li>
<li>Strong sector momentum in biotech</li>
</ul>

<p><strong>Execution:</strong></p>
<ul>
<li>Entry at $49.86 was precise</li>
<li>Used 1% position size</li>
<li>Stop loss at $49.20</li>
</ul>

<p><strong>Outcome:</strong></p>
<ul>
<li>Stock moved as expected to $51.52</li>
<li>Exited when momentum started to fade</li>
<li>Profit of $531.20 (3.33% gain)</li>
</ul>

<p><strong>Lessons:</strong></p>
<ul>
<li>Pre-market volume was key indicator</li>
<li>Patience paid off waiting for clean breakout</li>
<li>Exit timing was good, avoided the pullback</li>
</ul>`,
    emotion: 'confident',
    category: 'win',
    template: 'trading-analysis',
    createdAt: '2024-01-29T16:45:00Z'
  },
  {
    id: '2',
    date: '2024-01-29',
    title: 'Quick Loss on YIBO Reversal',
    strategy: 'FOMO Chase',
    side: 'Long',
    setup: 'FOMO chase',
    bias: 'Long',
    pnl: -84.00,
    rating: 2,
    tags: ['reversal', 'mistake', 'fomo'],
    content: `<p>Made a mistake here. Chased YIBO after missing the initial move.</p>

<p><strong>Setup Analysis:</strong></p>
<ul>
<li>Stock already extended from the breakout</li>
<li>No clear setup, just FOMO</li>
<li>Should have waited for pullback</li>
</ul>

<p><strong>Execution:</strong></p>
<ul>
<li>Entry at $52.15 was too high</li>
<li>Position size was appropriate</li>
<li>Quick stop at $51.45 limited damage</li>
</ul>

<p><strong>Outcome:</strong></p>
<ul>
<li>Small loss of $84</li>
<li>Quick recognition of mistake</li>
<li>Preserved capital for better setups</li>
</ul>

<p><strong>Lessons:</strong></p>
<ul>
<li>Don't chase extended moves</li>
<li>Wait for pullbacks or new setups</li>
<li>FOMO leads to poor entries</li>
<li>Quick stops are crucial</li>
</ul>`,
    emotion: 'frustrated',
    category: 'loss',
    template: 'trading-analysis',
    createdAt: '2024-01-29T17:05:00Z'
  },
  {
    id: '3',
    date: '2024-01-28',
    title: 'Excellent LPO Swing Trade',
    strategy: 'Swing Trading',
    side: 'Long',
    setup: 'Support bounce + earnings catalyst',
    bias: 'Long',
    pnl: 1636.60,
    rating: 5,
    tags: ['swing', 'support', 'earnings'],
    content: `<p>Outstanding swing trade on LPO. Entered at key support level ahead of earnings.</p>

<p><strong>Setup Analysis:</strong></p>
<ul>
<li>Perfect bounce off $65 support level</li>
<li>Strong earnings setup with low expectations</li>
<li>Good risk/reward ratio</li>
</ul>

<p><strong>Execution:</strong></p>
<ul>
<li>Large position size (980 shares)</li>
<li>Entry right at support</li>
<li>Stop below $64.50</li>
</ul>

<p><strong>Outcome:</strong></p>
<ul>
<li>Stock gapped up after earnings</li>
<li>Exited at $66.87 for solid profit</li>
<li>Best trade of the month so far</li>
</ul>

<p><strong>Lessons:</strong></p>
<ul>
<li>Support levels work great for entries</li>
<li>Earnings can provide catalyst</li>
<li>Sizing up on high conviction trades pays off</li>
</ul>`,
    emotion: 'excited',
    category: 'win',
    template: 'trading-analysis',
    createdAt: '2024-01-28T14:30:00Z'
  },
  {
    id: '4',
    date: '2024-01-26',
    title: 'Range Trading CMAX',
    strategy: 'Range Trading',
    side: 'Long',
    setup: 'Range scalp',
    bias: 'Neutral',
    pnl: 22.00,
    rating: 3,
    tags: ['range', 'scalp', 'low-volume'],
    content: `<p>Small profit on CMAX range trade. Market was slow today.</p>

<p><strong>Setup Analysis:</strong></p>
<ul>
<li>Clear range between $21-$21.50</li>
<li>Low volume environment</li>
<li>Good for small scalps</li>
</ul>

<p><strong>Execution:</strong></p>
<ul>
<li>Entry near range bottom</li>
<li>Small position due to low conviction</li>
<li>Quick profit target</li>
</ul>

<p><strong>Outcome:</strong></p>
<ul>
<li>Small profit after commissions</li>
<li>Not much size but consistent</li>
</ul>

<p><strong>Lessons:</strong></p>
<ul>
<li>Range trading works in slow markets</li>
<li>Keep size smaller on low conviction</li>
<li>Small profits add up</li>
</ul>`,
    emotion: 'neutral',
    category: 'win',
    template: 'quick-trade-log',
    createdAt: '2024-01-26T11:20:00Z'
  }
]

// Template system for journal entries
interface JournalTemplate {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  category: 'trading' | 'analysis' | 'freeform'
  fields: {
    id: string
    label: string
    type: 'text' | 'textarea' | 'select' | 'number' | 'rich-text'
    placeholder?: string
    options?: string[]
    required?: boolean
    defaultValue?: string
  }[]
  contentTemplate: string
}

const journalTemplates: JournalTemplate[] = [
  {
    id: 'trading-analysis',
    name: 'Trading Analysis',
    description: 'Comprehensive trade analysis with setup, execution, and lessons',
    icon: <BarChart3 className="h-4 w-4" />,
    category: 'trading',
    fields: [
      { id: 'strategy', label: 'Strategy', type: 'text', placeholder: 'Momentum Breakout', required: true },
      { id: 'setup', label: 'Setup Type', type: 'select', options: ['Breakout', 'Pullback', 'Support/Resistance', 'Momentum', 'Reversal', 'Range Trade', 'Gap Play', 'Earnings', 'News Event', 'Technical Pattern'], required: true },
      { id: 'bias', label: 'Market Bias', type: 'select', options: ['Long', 'Short', 'Neutral'], required: true, defaultValue: 'Long' },
      { id: 'pnl', label: 'P&L ($)', type: 'number', placeholder: '0.00', required: true },
    ],
    contentTemplate: `<h1>Setup Analysis</h1>
<ul>
<li>Market conditions:</li>
<li>Key levels identified:</li>
<li>Volume analysis:</li>
<li>Risk/reward assessment:</li>
</ul>

<h1>Execution</h1>
<ul>
<li>Entry strategy:</li>
<li>Position sizing:</li>
<li>Stop loss placement:</li>
<li>Target levels:</li>
</ul>

<h1>Outcome</h1>
<ul>
<li>What happened:</li>
<li>Exit reasoning:</li>
<li>Performance vs plan:</li>
</ul>

<h1>Lessons Learned</h1>
<ul>
<li>What worked well:</li>
<li>Areas for improvement:</li>
<li>Future applications:</li>
</ul>`
  },
  {
    id: 'quick-trade-log',
    name: 'Quick Trade Log',
    description: 'Simple trade entry for quick documentation',
    icon: <Clock3 className="h-4 w-4" />,
    category: 'trading',
    fields: [
      { id: 'strategy', label: 'Strategy', type: 'text', placeholder: 'Quick Scalp', required: true },
      { id: 'setup', label: 'Setup', type: 'text', placeholder: 'Range bounce', required: true },
      { id: 'bias', label: 'Bias', type: 'select', options: ['Long', 'Short', 'Neutral'], required: true, defaultValue: 'Long' },
      { id: 'pnl', label: 'P&L ($)', type: 'number', placeholder: '0.00', required: true },
    ],
    contentTemplate: `<p><strong>Quick Notes:</strong></p>
<ul>
<li>Setup:</li>
<li>Execution:</li>
<li>Result:</li>
<li>Key takeaway:</li>
</ul>`
  },
  {
    id: 'weekly-review',
    name: 'Weekly Review',
    description: 'Weekly performance and strategy review',
    icon: <Calendar className="h-4 w-4" />,
    category: 'analysis',
    fields: [
      { id: 'weekOf', label: 'Week Of', type: 'text', placeholder: 'Jan 22-26, 2024', required: true },
      { id: 'totalPnl', label: 'Total P&L ($)', type: 'number', placeholder: '0.00', required: true },
    ],
    contentTemplate: `<h1>Week of [DATE]</h1>

<h2>Performance Summary</h2>
<ul>
<li>Total P&L: $</li>
<li>Number of trades:</li>
<li>Win rate: %</li>
<li>Best trade:</li>
<li>Worst trade:</li>
</ul>

<h2>Market Conditions</h2>
<ul>
<li>Overall market sentiment:</li>
<li>Key events/news:</li>
<li>Volatility levels:</li>
</ul>

<h2>Strategy Performance</h2>
<ul>
<li>What strategies worked:</li>
<li>What didn't work:</li>
<li>Adjustments needed:</li>
</ul>

<h2>Goals for Next Week</h2>
<ul>
<li>Primary focus:</li>
<li>Risk management improvements:</li>
<li>New opportunities to watch:</li>
</ul>`
  },
  {
    id: 'strategy-analysis',
    name: 'Strategy Analysis',
    description: 'Deep dive into specific trading strategy performance',
    icon: <Lightbulb className="h-4 w-4" />,
    category: 'analysis',
    fields: [
      { id: 'strategyName', label: 'Strategy Name', type: 'text', placeholder: 'Momentum Breakouts', required: true },
      { id: 'timeframe', label: 'Analysis Timeframe', type: 'select', options: ['1 Week', '2 Weeks', '1 Month', '3 Months', '6 Months', '1 Year'], required: true },
    ],
    contentTemplate: `<h1>Strategy: [STRATEGY NAME]</h1>

<h2>Strategy Overview</h2>
<ul>
<li>Core methodology:</li>
<li>Entry criteria:</li>
<li>Exit criteria:</li>
<li>Risk management rules:</li>
</ul>

<h2>Performance Metrics</h2>
<ul>
<li>Total trades executed:</li>
<li>Win rate:</li>
<li>Average win:</li>
<li>Average loss:</li>
<li>Profit factor:</li>
<li>Maximum drawdown:</li>
</ul>

<h2>Detailed Analysis</h2>
<ul>
<li>Market conditions that favor this strategy:</li>
<li>Common failure patterns:</li>
<li>Optimal position sizing:</li>
<li>Best timeframes/sessions:</li>
</ul>

<h2>Refinements & Improvements</h2>
<ul>
<li>Rule modifications:</li>
<li>Additional filters to consider:</li>
<li>Risk management adjustments:</li>
</ul>

<h2>Conclusion</h2>
<ul>
<li>Strategy viability:</li>
<li>Recommended allocation:</li>
<li>Next steps:</li>
</ul>`
  },
  {
    id: 'market-research',
    name: 'Market Research',
    description: 'Research notes on market conditions, sectors, or specific stocks',
    icon: <Search className="h-4 w-4" />,
    category: 'analysis',
    fields: [
      { id: 'researchTopic', label: 'Research Topic', type: 'text', placeholder: 'Tech Sector Rotation', required: true },
      { id: 'focusArea', label: 'Focus Area', type: 'select', options: ['Individual Stock', 'Sector Analysis', 'Market Conditions', 'Economic Data', 'Technical Analysis', 'News/Events'], required: true },
    ],
    contentTemplate: `<h1>Research: [TOPIC]</h1>

<h2>Key Findings</h2>
<ul>
<li>Primary insights:</li>
<li>Supporting data:</li>
<li>Market implications:</li>
</ul>

<h2>Technical Analysis</h2>
<ul>
<li>Chart patterns observed:</li>
<li>Key support/resistance levels:</li>
<li>Volume analysis:</li>
<li>Indicator signals:</li>
</ul>

<h2>Fundamental Factors</h2>
<ul>
<li>Financial metrics:</li>
<li>News/catalysts:</li>
<li>Industry trends:</li>
<li>Competitive position:</li>
</ul>

<h2>Trading Opportunities</h2>
<ul>
<li>Potential setups:</li>
<li>Entry strategies:</li>
<li>Risk considerations:</li>
<li>Time horizon:</li>
</ul>

<h2>Watchlist Updates</h2>
<ul>
<li>Stocks to monitor:</li>
<li>Key levels to watch:</li>
<li>Catalyst dates:</li>
</ul>`
  },
  {
    id: 'risk-management',
    name: 'Risk Management',
    description: 'Risk assessment and portfolio management notes',
    icon: <Shield className="h-4 w-4" />,
    category: 'analysis',
    fields: [
      { id: 'portfolioValue', label: 'Portfolio Value ($)', type: 'number', placeholder: '100000', required: true },
      { id: 'riskAssessment', label: 'Risk Level', type: 'select', options: ['Conservative', 'Moderate', 'Aggressive'], required: true, defaultValue: 'Moderate' },
    ],
    contentTemplate: `<h1>Risk Management Review</h1>

<h2>Current Portfolio Status</h2>
<ul>
<li>Total portfolio value: $</li>
<li>Cash position: %</li>
<li>Position concentration:</li>
<li>Sector exposure:</li>
</ul>

<h2>Risk Metrics</h2>
<ul>
<li>Portfolio beta:</li>
<li>Maximum position size:</li>
<li>Daily VaR:</li>
<li>Monthly drawdown limit:</li>
</ul>

<h2>Position Sizing Rules</h2>
<ul>
<li>Standard position size:</li>
<li>High conviction sizing:</li>
<li>Risk per trade:</li>
<li>Stop loss methodology:</li>
</ul>

<h2>Portfolio Adjustments</h2>
<ul>
<li>Positions to reduce:</li>
<li>Sectors to trim:</li>
<li>Hedging strategies:</li>
<li>Cash management:</li>
</ul>

<h2>Risk Controls</h2>
<ul>
<li>Daily loss limits:</li>
<li>Weekly review triggers:</li>
<li>Position correlation checks:</li>
<li>Stress test scenarios:</li>
</ul>`
  },
  {
    id: 'freeform',
    name: 'Freeform Document',
    description: 'Completely customizable document for any content',
    icon: <FileText className="h-4 w-4" />,
    category: 'freeform',
    fields: [
      { id: 'documentTitle', label: 'Document Title', type: 'text', placeholder: 'My Trading Notes', required: true },
      { id: 'documentType', label: 'Document Type', type: 'text', placeholder: 'General Notes', required: false },
    ],
    contentTemplate: `<h1>[TITLE]</h1>

<p>Start writing your content here. You can use:</p>

<h2>Headings</h2>
<h3>Subheadings</h3>

<p><strong>Bold text</strong> and <em>italic text</em></p>

<ul>
<li>Bullet points</li>
<li>Lists</li>
<li>And more</li>
</ul>

<ol>
<li>Numbered lists</li>
<li>Work too</li>
</ol>

<blockquote>
<p>Quote blocks for important insights</p>
</blockquote>

<hr>

<p>Create any structure you need for your trading journal, research notes, or analysis.</p>`
  }
]

interface JournalEntry {
  id: string
  date: string
  title: string
  strategy: string
  side: 'Long' | 'Short'
  setup: string
  bias: 'Long' | 'Short' | 'Neutral'
  pnl: number
  rating: number
  tags: string[]
  content: string
  emotion: string
  category: 'win' | 'loss'
  createdAt: string
  template?: string
}

interface JournalEntryCardProps {
  entry: JournalEntry
  onEdit: (entry: JournalEntry) => void
  onDelete: (id: string) => void
}

export function JournalEntryCard({ entry, onEdit, onDelete }: JournalEntryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div data-testid="journal-entry-card" className="studio-surface rounded-lg p-6 hover:bg-[#0f0f0f] transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <h3 className="text-lg font-semibold studio-text">{entry.title}</h3>
            {/* Calendar-linked indicator for daily reviews */}
            {entry.tags?.includes('calendar-linked') && (
              <div className="flex items-center space-x-1 px-2 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full">
                <Calendar className="h-3 w-3 text-yellow-500" />
                <span className="text-xs text-yellow-500 font-medium">Calendar</span>
              </div>
            )}
            <div className="flex items-center space-x-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    'h-4 w-4',
                    i < entry.rating
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-gray-600'
                  )}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-4 text-sm studio-muted">
            <div className="flex items-center space-x-1">
              <Calendar className="h-4 w-4" />
              <span>{new Date(entry.date).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="font-medium text-primary">{entry.strategy}</span>
              <span className={cn(
                'px-2 py-1 rounded text-xs',
                entry.side === 'Long'
                  ? 'bg-green-900/50 text-green-300'
                  : 'bg-red-900/50 text-red-300'
              )}>
                {entry.side}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <DollarSign className="h-4 w-4" />
              <span className={cn(
                'font-bold',
                entry.pnl >= 0 ? 'text-trading-profit' : 'text-trading-loss'
              )}>
                {entry.pnl >= 0 ? '+' : ''}${entry.pnl.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            data-testid="edit-journal-entry"
            onClick={() => onEdit(entry)}
            className="p-2 hover:bg-[#1a1a1a] rounded transition-colors"
            title="Edit entry"
          >
            <Edit className="h-4 w-4 studio-muted hover:studio-text" />
          </button>
          <button
            data-testid="delete-journal-entry"
            onClick={() => onDelete(entry.id)}
            className="p-2 hover:bg-[#1a1a1a] rounded transition-colors"
            title="Delete entry"
          >
            <Trash2 className="h-4 w-4 studio-muted hover:text-red-400" />
          </button>
        </div>
      </div>

      {/* Tags */}
      <div className="flex items-center space-x-2 mb-4">
        {entry.tags.map((tag, index) => (
          <span
            key={index}
            className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-900/50 text-blue-300 border border-blue-700/50"
          >
            <Tag className="h-3 w-3 mr-1" />
            {tag}
          </span>
        ))}
      </div>

      {/* Trade Details */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <div className="text-xs studio-muted">Setup</div>
          <div className="text-sm studio-text">{entry.setup}</div>
        </div>
        <div>
          <div className="text-xs studio-muted">Bias</div>
          <div className={cn(
            'text-sm font-medium',
            entry.bias === 'Long' ? 'text-trading-profit' :
            entry.bias === 'Short' ? 'text-trading-loss' : 'text-trading-neutral'
          )}>
            {entry.bias}
          </div>
        </div>
        <div>
          <div className="text-xs studio-muted">Emotion</div>
          <div className="text-sm capitalize studio-text">{entry.emotion}</div>
        </div>
        <div>
          <div className="text-xs studio-muted">Category</div>
          <div className={cn(
            'text-sm capitalize font-medium',
            entry.category === 'win' ? 'text-trading-profit' : 'text-trading-loss'
          )}>
            {entry.category}
          </div>
        </div>
      </div>

      {/* Content Preview */}
      <div className="mb-4">
        <div className="text-sm studio-text">
          {isExpanded ? (
            <div
              className="[&_p]:mb-3 [&_p]:text-gray-300 [&_p]:leading-relaxed [&_strong]:text-white [&_strong]:font-bold [&_em]:text-gray-400 [&_em]:italic [&_ul]:ml-4 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:text-gray-300 [&_li]:mb-1 [&_li]:text-gray-300 [&_h1]:text-white [&_h1]:font-semibold [&_h1]:text-base [&_h1]:mb-2 [&_h1]:mt-4 [&_h2]:text-white [&_h2]:font-semibold [&_h2]:text-sm [&_h2]:mb-2 [&_h2]:mt-3 [&_h3]:text-white [&_h3]:font-medium [&_h3]:text-sm [&_h3]:mb-2 [&_h3]:mt-3"
              dangerouslySetInnerHTML={{ __html: entry.content }}
            />
          ) : (
            <div
              className="line-clamp-3 [&_p]:mb-3 [&_p]:text-gray-300 [&_p]:leading-relaxed [&_strong]:text-white [&_strong]:font-bold [&_em]:text-gray-400 [&_em]:italic [&_ul]:ml-4 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:text-gray-300 [&_li]:mb-1 [&_li]:text-gray-300 [&_h1]:text-white [&_h1]:font-semibold [&_h1]:text-base [&_h1]:mb-2 [&_h1]:mt-4 [&_h2]:text-white [&_h2]:font-semibold [&_h2]:text-sm [&_h2]:mb-2 [&_h2]:mt-3 [&_h3]:text-white [&_h3]:font-medium [&_h3]:text-sm [&_h3]:mb-2 [&_h3]:mt-3"
              dangerouslySetInnerHTML={{
                __html: entry.content.length > 300
                  ? entry.content.substring(0, 300) + '...'
                  : entry.content
              }}
            />
          )}
        </div>
      </div>

      {/* Expand/Collapse Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-sm text-primary hover:text-primary/80 transition-colors"
      >
        {isExpanded ? 'Show Less' : 'Read More'}
      </button>
    </div>
  )
}

interface JournalFiltersProps {
  filters: {
    search: string
    category: string
    emotion: string
    symbol: string
    rating: number
  }
  onFiltersChange: (filters: any) => void
}

export function JournalFilters({ filters, onFiltersChange }: JournalFiltersProps) {
  return (
    <div className="studio-surface rounded-lg p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 studio-muted" />
          <input
            type="text"
            placeholder="Search entries..."
            className="pl-10 pr-4 py-2 w-full studio-surface studio-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          />
        </div>

        {/* Category Filter */}
        <select
          className="px-4 py-2 studio-surface studio-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          value={filters.category}
          onChange={(e) => onFiltersChange({ ...filters, category: e.target.value })}
        >
          <option value="">All Categories</option>
          <option value="win">Wins</option>
          <option value="loss">Losses</option>
        </select>

        {/* Emotion Filter */}
        <select
          className="px-4 py-2 studio-surface studio-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          value={filters.emotion}
          onChange={(e) => onFiltersChange({ ...filters, emotion: e.target.value })}
        >
          <option value="">All Emotions</option>
          <option value="confident">Confident</option>
          <option value="excited">Excited</option>
          <option value="frustrated">Frustrated</option>
          <option value="neutral">Neutral</option>
        </select>

        {/* Symbol Filter */}
        <input
          type="text"
          placeholder="Filter by symbol..."
          className="px-4 py-2 studio-surface studio-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          value={filters.symbol}
          onChange={(e) => onFiltersChange({ ...filters, symbol: e.target.value })}
        />

        {/* Rating Filter */}
        <select
          className="px-4 py-2 studio-surface studio-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          value={filters.rating}
          onChange={(e) => onFiltersChange({ ...filters, rating: Number(e.target.value) })}
        >
          <option value={0}>All Ratings</option>
          <option value={5}>5 Stars</option>
          <option value={4}>4+ Stars</option>
          <option value={3}>3+ Stars</option>
          <option value={2}>2+ Stars</option>
          <option value={1}>1+ Stars</option>
        </select>
      </div>
    </div>
  )
}

export function JournalStats() {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  // Helper function to calculate metrics for a time period
  const calculatePeriodStats = (daysBack: number) => {
    const cutoffDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
    const periodEntries = mockJournalEntries.filter(entry =>
      new Date(entry.date) >= cutoffDate
    )

    const totalPnL = periodEntries.reduce((sum, entry) => sum + entry.pnl, 0)
    const wins = periodEntries.filter(entry => entry.category === 'win').length
    const winRate = periodEntries.length > 0 ? (wins / periodEntries.length) * 100 : 0
    const avgWin = wins > 0 ? periodEntries.filter(e => e.category === 'win').reduce((sum, e) => sum + e.pnl, 0) / wins : 0
    const losses = periodEntries.filter(entry => entry.category === 'loss').length
    const avgLoss = losses > 0 ? Math.abs(periodEntries.filter(e => e.category === 'loss').reduce((sum, e) => sum + e.pnl, 0) / losses) : 0
    const rRatio = avgLoss > 0 ? avgWin / avgLoss : 0

    return {
      entries: periodEntries.length,
      pnl: totalPnL,
      winRate,
      rRatio
    }
  }

  const stats7d = calculatePeriodStats(7)
  const stats30d = calculatePeriodStats(30)
  const stats90d = calculatePeriodStats(90)

  const totalEntries = mockJournalEntries.length
  const totalPnL = mockJournalEntries.reduce((sum, entry) => sum + entry.pnl, 0)
  const avgRating = totalEntries > 0 ? mockJournalEntries.reduce((sum, entry) => sum + entry.rating, 0) / totalEntries : 0

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
      {/* 7-Day Calendar */}
      <div className="studio-surface rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm studio-muted">7d Cal</div>
          <Calendar className="h-4 w-4 studio-muted" />
        </div>
        <div className="text-2xl font-bold studio-text">{stats7d.entries}</div>
        <div className="text-xs text-trading-profit">{stats7d.winRate.toFixed(1)}% win</div>
      </div>

      {/* 30-Day Calendar */}
      <div className="studio-surface rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm studio-muted">30d Cal</div>
          <Calendar className="h-4 w-4 studio-muted" />
        </div>
        <div className="text-2xl font-bold studio-text">{stats30d.entries}</div>
        <div className="text-xs text-trading-profit">{stats30d.winRate.toFixed(1)}% win</div>
      </div>

      {/* 90-Day Calendar */}
      <div className="studio-surface rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm studio-muted">90d Cal</div>
          <Calendar className="h-4 w-4 studio-muted" />
        </div>
        <div className="text-2xl font-bold studio-text">{stats90d.entries}</div>
        <div className="text-xs text-trading-profit">{stats90d.winRate.toFixed(1)}% win</div>
      </div>

      {/* 7-Day P&L */}
      <div className="studio-surface rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm studio-muted">7d $</div>
          <DollarSign className="h-4 w-4 studio-muted" />
        </div>
        <div className={cn(
          "text-2xl font-bold",
          stats7d.pnl >= 0 ? "text-trading-profit" : "text-trading-loss"
        )}>
          {stats7d.pnl >= 0 ? '+' : ''}${stats7d.pnl.toFixed(0)}
        </div>
        <div className="text-xs studio-muted">P&L</div>
      </div>

      {/* 30-Day P&L */}
      <div className="studio-surface rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm studio-muted">30d $</div>
          <DollarSign className="h-4 w-4 studio-muted" />
        </div>
        <div className={cn(
          "text-2xl font-bold",
          stats30d.pnl >= 0 ? "text-trading-profit" : "text-trading-loss"
        )}>
          {stats30d.pnl >= 0 ? '+' : ''}${stats30d.pnl.toFixed(0)}
        </div>
        <div className="text-xs studio-muted">P&L</div>
      </div>

      {/* 90-Day % Win Rate */}
      <div className="studio-surface rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm studio-muted">90d %</div>
          <Target className="h-4 w-4 studio-muted" />
        </div>
        <div className="text-2xl font-bold text-trading-profit">{stats90d.winRate.toFixed(1)}%</div>
        <div className="text-xs studio-muted">Win Rate</div>
      </div>

      {/* Overall R-Ratio */}
      <div className="studio-surface rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm studio-muted">Avg R</div>
          <TrendingUp className="h-4 w-4 studio-muted" />
        </div>
        <div className="text-2xl font-bold studio-text">{stats30d.rRatio.toFixed(1)}</div>
        <div className="text-xs studio-muted">Risk/Reward</div>
      </div>
    </div>
  )
}

interface NewEntryModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (entry: Partial<JournalEntry>) => void
  editingEntry?: JournalEntry | null
}

// TipTap Rich Text Editor Component

// Now using BlockNote instead of TipTap
function RichTextEditor({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <BlockNoteEditor
      value={value}
      onChange={onChange}
      placeholder={placeholder}
    />
  )
}

// Template Selection Component
function TemplateSelector({ selectedTemplate, onSelect }: { selectedTemplate: string | null; onSelect: (template: JournalTemplate) => void }) {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'trading' | 'analysis' | 'freeform'>('all')

  const filteredTemplates = selectedCategory === 'all'
    ? journalTemplates
    : journalTemplates.filter(t => t.category === selectedCategory)

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold studio-text">Choose a Template</h3>
        <p className="text-sm studio-muted">Select a template to get started with your journal entry</p>
      </div>

      {/* Category Filter */}
      <div className="flex justify-center">
        <div className="flex items-center space-x-1 bg-[#1a1a1a] rounded-lg p-1">
          {[
            { id: 'all', label: 'All' },
            { id: 'trading', label: 'Trading' },
            { id: 'analysis', label: 'Analysis' },
            { id: 'freeform', label: 'Freeform' }
          ].map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id as any)}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                selectedCategory === category.id
                  ? 'bg-primary text-primary-foreground'
                  : 'studio-muted hover:bg-[#2a2a2a] hover:studio-text'
              )}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map((template) => (
          <div
            key={template.id}
            onClick={() => onSelect(template)}
            className={cn(
              "studio-surface rounded-lg p-4 cursor-pointer transition-all duration-200 hover:bg-[#161616] border-2",
              selectedTemplate === template.id
                ? "border-primary shadow-lg shadow-primary/20"
                : "border-transparent hover:border-studio-border"
            )}
          >
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                {template.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold studio-text mb-1">{template.name}</h4>
                <p className="text-sm studio-muted leading-relaxed">{template.description}</p>
                <div className="mt-2">
                  <span className={cn(
                    "inline-block px-2 py-1 rounded text-xs font-medium",
                    template.category === 'trading' ? 'bg-green-900/30 text-green-300' :
                    template.category === 'analysis' ? 'bg-blue-900/30 text-blue-300' :
                    'bg-purple-900/30 text-purple-300'
                  )}>
                    {template.category}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function NewEntryModal({ isOpen, onClose, onSave, editingEntry }: NewEntryModalProps) {
  const [currentStep, setCurrentStep] = useState<'template' | 'edit' | 'view'>('template')
  const [selectedTemplate, setSelectedTemplate] = useState<JournalTemplate | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [formData, setFormData] = useState<Record<string, any>>({})

  // Initialize form when editing an entry or selecting a template
  useEffect(() => {
    if (editingEntry) {
      // Load existing entry
      const template = journalTemplates.find(t => t.id === editingEntry.template) || journalTemplates[0]
      setSelectedTemplate(template)

      // Check if content is markdown and convert to HTML if needed
      let content = editingEntry.content || ''
      if (content.includes('**') || content.includes('*') || content.includes('\n- ')) {
        // Content appears to be markdown, convert to HTML
        content = markdownToHtml(content)
      }

      setFormData({
        title: editingEntry.title,
        strategy: editingEntry.strategy || '',
        side: editingEntry.side || 'Long',
        setup: editingEntry.setup || '',
        bias: editingEntry.bias || 'Long',
        pnl: editingEntry.pnl?.toString() || '0',
        rating: editingEntry.rating || 3,
        tags: Array.isArray(editingEntry.tags) ? editingEntry.tags.join(', ') : editingEntry.tags || '',
        content: content,
        emotion: editingEntry.emotion || 'neutral',
        category: editingEntry.category || 'win',
        // Include template-specific fields
        ...template.fields.reduce((acc, field) => {
          acc[field.id] = (editingEntry as any)[field.id] || field.defaultValue || ''
          return acc
        }, {} as Record<string, any>)
      })
      setCurrentStep('view')
      setIsEditMode(false)
    } else {
      // Reset for new entry
      setCurrentStep('template')
      setSelectedTemplate(null)
      setFormData({})
      setIsEditMode(true)
    }
  }, [editingEntry, isOpen])

  const handleTemplateSelect = (template: JournalTemplate) => {
    setSelectedTemplate(template)

    // Initialize form with template defaults
    const initialData = {
      title: '',
      rating: 3,
      tags: '',
      content: template.contentTemplate,
      emotion: 'neutral',
      category: 'win' as 'win' | 'loss',
      side: 'Long' as 'Long' | 'Short',
      ...template.fields.reduce((acc, field) => {
        acc[field.id] = field.defaultValue || (field.type === 'number' ? '0' : '')
        return acc
      }, {} as Record<string, any>)
    }

    setFormData(initialData)
    setCurrentStep('edit')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const entry = {
      ...formData,
      // Ensure numeric fields are properly converted
      pnl: parseFloat(formData.pnl || '0'),
      rating: Number(formData.rating || 3),
      tags: typeof formData.tags === 'string' ? formData.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean) : formData.tags || [],
      date: editingEntry ? editingEntry.date : new Date().toISOString().split('T')[0],
      createdAt: editingEntry ? editingEntry.createdAt : new Date().toISOString(),
      template: selectedTemplate?.id,
      id: editingEntry ? editingEntry.id : undefined
    }

    onSave(entry)
    onClose()
  }

  const toggleEditMode = () => {
    setIsEditMode(!isEditMode)
    if (!isEditMode) {
      setCurrentStep('edit')
    } else {
      setCurrentStep('view')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 py-8">
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        <div className="relative studio-surface rounded-xl shadow-studio-prominent w-full max-w-6xl max-h-[95vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b studio-border bg-gradient-to-r from-[#111111] to-[#161616]">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-bold studio-text">
                {editingEntry ? 'Journal Entry' : 'New Journal Entry'}
              </h2>
              {selectedTemplate && (
                <div className="flex items-center space-x-2 px-3 py-1 bg-primary/10 rounded-full">
                  {selectedTemplate.icon}
                  <span className="text-sm font-medium text-primary">{selectedTemplate.name}</span>
                </div>
              )}
              {editingEntry && (
                <button
                  onClick={toggleEditMode}
                  className={cn(
                    "flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200",
                    isEditMode
                      ? "bg-primary text-primary-foreground shadow-lg"
                      : "studio-surface hover:bg-[#1a1a1a] studio-text border studio-border"
                  )}
                >
                  <Edit className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {isEditMode ? 'View Mode' : 'Edit Mode'}
                  </span>
                </button>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors"
            >
              <X className="h-5 w-5 studio-muted hover:studio-text" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(95vh-120px)]">
            {currentStep === 'template' && (
              <div className="p-8">
                <TemplateSelector
                  selectedTemplate={selectedTemplate?.id || null}
                  onSelect={handleTemplateSelect}
                />
              </div>
            )}

            {currentStep === 'edit' && selectedTemplate && (
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                {/* Title Field */}
                <div className="space-y-2">
                  <label className="text-lg font-semibold studio-text">Title</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 text-lg form-input"
                    value={formData.title || ''}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter a descriptive title"
                    required
                  />
                </div>

                {/* Template-specific fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {selectedTemplate.fields.map((field) => (
                    <div key={field.id} className="space-y-2">
                      <label className="text-sm font-medium studio-text">
                        {field.label}
                        {field.required && <span className="text-red-400 ml-1">*</span>}
                      </label>
                      {field.type === 'select' ? (
                        <select
                          className="w-full px-4 py-3 form-input"
                          value={formData[field.id] || field.defaultValue || ''}
                          onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                          required={field.required}
                        >
                          {field.options?.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      ) : field.type === 'number' ? (
                        <input
                          type="number"
                          step="0.01"
                          className="w-full px-4 py-3 form-input"
                          value={formData[field.id] || ''}
                          onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                          placeholder={field.placeholder}
                          required={field.required}
                        />
                      ) : field.type === 'textarea' ? (
                        <textarea
                          rows={4}
                          className="w-full px-4 py-3 form-input resize-none"
                          value={formData[field.id] || ''}
                          onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                          placeholder={field.placeholder}
                          required={field.required}
                        />
                      ) : (
                        <input
                          type="text"
                          className="w-full px-4 py-3 form-input"
                          value={formData[field.id] || ''}
                          onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                          placeholder={field.placeholder}
                          required={field.required}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* Universal fields for trading templates */}
                {selectedTemplate.category === 'trading' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium studio-text">Rating</label>
                      <select
                        className="w-full px-4 py-3 form-input"
                        value={formData.rating || 3}
                        onChange={(e) => setFormData({ ...formData, rating: Number(e.target.value) })}
                      >
                        <option value={1}>⭐ 1 Star</option>
                        <option value={2}>⭐⭐ 2 Stars</option>
                        <option value={3}>⭐⭐⭐ 3 Stars</option>
                        <option value={4}>⭐⭐⭐⭐ 4 Stars</option>
                        <option value={5}>⭐⭐⭐⭐⭐ 5 Stars</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium studio-text">Emotion</label>
                      <select
                        className="w-full px-4 py-3 form-input"
                        value={formData.emotion || 'neutral'}
                        onChange={(e) => setFormData({ ...formData, emotion: e.target.value })}
                      >
                        <option value="confident">😎 Confident</option>
                        <option value="excited">🚀 Excited</option>
                        <option value="frustrated">😤 Frustrated</option>
                        <option value="neutral">😐 Neutral</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium studio-text">Category</label>
                      <select
                        className="w-full px-4 py-3 form-input"
                        value={formData.category || 'win'}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      >
                        <option value="win">✅ Win</option>
                        <option value="loss">❌ Loss</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Tags */}
                <div className="space-y-2">
                  <label className="text-sm font-medium studio-text">Tags</label>
                  <input
                    type="text"
                    placeholder="momentum, breakout, pre-market"
                    className="w-full px-4 py-3 form-input"
                    value={formData.tags || ''}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  />
                  <p className="text-xs studio-muted">Separate tags with commas</p>
                </div>

                {/* Rich Text Content */}
                <div className="space-y-2">
                  <label className="text-sm font-medium studio-text">Content</label>
                  <RichTextEditor
                    value={formData.content || ''}
                    onChange={(content) => setFormData({ ...formData, content })}
                    placeholder="Write your analysis, notes, and observations..."
                  />
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-between pt-6 border-t studio-border">
                  {!editingEntry && (
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentStep('template')
                        setSelectedTemplate(null)
                        setFormData({})
                      }}
                      className="btn-ghost px-6 py-3"
                    >
                      Back to Templates
                    </button>
                  )}
                  <div className="flex space-x-4 ml-auto">
                    <button
                      type="button"
                      onClick={onClose}
                      className="btn-ghost px-6 py-3"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary px-6 py-3"
                    >
                      Save Entry
                    </button>
                  </div>
                </div>
              </form>
            )}

            {currentStep === 'view' && editingEntry && selectedTemplate && (
              <div className="p-8 space-y-8">
                {/* Entry Display */}
                <div className="space-y-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h1 className="text-3xl font-bold studio-text mb-3">{formData.title}</h1>
                      <div className="flex items-center space-x-6 text-lg">
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-5 w-5 studio-muted" />
                          <span className="studio-text">{new Date(editingEntry.date).toLocaleDateString()}</span>
                        </div>
                        {formData.strategy && (
                          <div className="flex items-center space-x-2">
                            <span className="text-2xl font-bold text-primary">{formData.strategy}</span>
                            {formData.bias && (
                              <span className={cn(
                                'px-3 py-1 rounded-full text-sm font-medium',
                                formData.bias === 'Long' ? 'bg-green-900/50 text-green-300 border border-green-700/50' :
                                formData.bias === 'Short' ? 'bg-red-900/50 text-red-300 border border-red-700/50' :
                                'bg-gray-900/50 text-gray-300 border border-gray-700/50'
                              )}>
                                {formData.bias}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Rating Stars */}
                    {formData.rating && (
                      <div className="flex items-center space-x-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              'h-6 w-6',
                              i < formData.rating
                                ? 'text-yellow-400 fill-yellow-400'
                                : 'text-gray-600'
                            )}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  {formData.tags && (
                    <div className="flex flex-wrap gap-2">
                      {(typeof formData.tags === 'string' ? formData.tags.split(',') : formData.tags).map((tag: string, index: number) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-900/50 text-blue-300 border border-blue-700/50"
                        >
                          <Tag className="h-3 w-3 mr-1" />
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Template-specific data display */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {selectedTemplate.fields.map((field) => {
                    const value = formData[field.id]
                    if (!value && value !== 0) return null

                    return (
                      <div key={field.id} className="studio-surface rounded-lg p-4 space-y-2">
                        <div className="text-sm studio-muted">{field.label}</div>
                        <div className={cn(
                          "text-lg font-semibold",
                          field.type === 'number' ? 'studio-text' : 'studio-text',
                          field.id === 'pnl' && (
                            parseFloat(value) >= 0 ? 'text-trading-profit' : 'text-trading-loss'
                          )
                        )}>
                          {field.type === 'number' && field.id === 'pnl' ?
                            `${parseFloat(value) >= 0 ? '+' : ''}$${parseFloat(value).toFixed(2)}` :
                            field.type === 'number' && field.label.includes('$') ?
                            `$${parseFloat(value).toFixed(2)}` :
                            value
                          }
                        </div>
                      </div>
                    )
                  })}

                  {formData.emotion && (
                    <div className="studio-surface rounded-lg p-4 space-y-2">
                      <div className="text-sm studio-muted">Emotion</div>
                      <div className="text-lg capitalize studio-text">{formData.emotion}</div>
                    </div>
                  )}

                  {formData.category && (
                    <div className="studio-surface rounded-lg p-4 space-y-2">
                      <div className="text-sm studio-muted">Category</div>
                      <div className={cn(
                        'text-lg capitalize font-medium',
                        formData.category === 'win' ? 'text-trading-profit' : 'text-trading-loss'
                      )}>
                        {formData.category}
                      </div>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold studio-text">Content</h3>
                  <div className="studio-surface rounded-lg p-6">
                    <div
                      className="prose-dark max-w-none studio-text leading-relaxed text-base"
                      dangerouslySetInnerHTML={{
                        __html: formData.content || "<p>No content provided.</p>"
                      }}
                    />
                  </div>
                </div>

                {/* View Mode Actions */}
                <div className="flex items-center justify-end space-x-4 pt-6 border-t studio-border">
                  <button
                    onClick={onClose}
                    className="btn-ghost px-6 py-3"
                  >
                    Close
                  </button>
                  <button
                    onClick={toggleEditMode}
                    className="btn-primary px-6 py-3"
                  >
                    Edit Entry
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Time Period Filter Component
interface TimePeriodFilterProps {
  selectedPeriod: string
  onPeriodChange: (period: string) => void
}

export function TimePeriodFilter({ selectedPeriod, onPeriodChange }: TimePeriodFilterProps) {
  const periods = [
    { id: '7d', label: '7d' },
    { id: '30d', label: '30d' },
    { id: '90d', label: '90d' },
    { id: 'all', label: 'All' }
  ]

  return (
    <div className="flex items-center space-x-1 bg-[#1a1a1a] rounded-lg p-1">
      {periods.map((period) => (
        <button
          key={period.id}
          onClick={() => onPeriodChange(period.id)}
          className={cn(
            'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            selectedPeriod === period.id
              ? 'bg-primary text-black'
              : 'studio-muted hover:bg-[#2a2a2a] hover:studio-text'
          )}
        >
          {period.label}
        </button>
      ))}
    </div>
  )
}

export { mockJournalEntries }