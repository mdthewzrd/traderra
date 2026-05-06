export interface SampleFolder {
  id: string
  name: string
  parentId?: string
  icon: string
  color: string
  description?: string
  position: number
}

export interface SampleDocument {
  id: string
  title: string
  folderId: string
  type: 'trade_entry' | 'strategy' | 'research' | 'review' | 'template' | 'note'
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export const SAMPLE_FOLDERS: SampleFolder[] = [
  // Root level folders
  {
    id: 'trading-journal',
    name: 'Trading Journal',
    icon: 'briefcase',
    color: '#60a5fa',
    description: 'Main trading activities and trade entries',
    position: 1
  },
  {
    id: 'strategies',
    name: 'Trading Strategies',
    icon: 'trending-up',
    color: '#34d399',
    description: 'Documented trading strategies and methodologies',
    position: 2
  },
  {
    id: 'research',
    name: 'Market Research',
    icon: 'book-open',
    color: '#a78bfa',
    description: 'Market analysis, stock research, and economic data',
    position: 3
  },
  {
    id: 'reviews',
    name: 'Performance Reviews',
    icon: 'target',
    color: '#fb923c',
    description: 'Monthly/quarterly performance analysis and goals',
    position: 4
  },
  {
    id: 'templates',
    name: 'Templates',
    icon: 'file-text',
    color: '#f472b6',
    description: 'Reusable templates for consistent documentation',
    position: 5
  },

  // Trading Journal subfolders
  {
    id: 'trades-2024',
    name: '2024 Trades',
    parentId: 'trading-journal',
    icon: 'folder',
    color: '#60a5fa',
    description: 'All trades from 2024',
    position: 1
  },
  {
    id: 'trades-2025',
    name: '2025 Trades',
    parentId: 'trading-journal',
    icon: 'folder',
    color: '#60a5fa',
    description: 'All trades from 2025',
    position: 2
  },
  {
    id: 'trades-january',
    name: 'January',
    parentId: 'trades-2024',
    icon: 'folder',
    color: '#60a5fa',
    position: 1
  },
  {
    id: 'trades-february',
    name: 'February',
    parentId: 'trades-2024',
    icon: 'folder',
    color: '#60a5fa',
    position: 2
  },
  {
    id: 'trades-march',
    name: 'March',
    parentId: 'trades-2024',
    icon: 'folder',
    color: '#60a5fa',
    position: 3
  },
  // 2025 Trade Folders
  {
    id: 'trades-january-2025',
    name: 'January 2025',
    parentId: 'trades-2025',
    icon: 'folder',
    color: '#60a5fa',
    position: 1
  },
  {
    id: 'trades-february-2025',
    name: 'February 2025',
    parentId: 'trades-2025',
    icon: 'folder',
    color: '#60a5fa',
    position: 2
  },
  {
    id: 'trades-march-2025',
    name: 'March 2025',
    parentId: 'trades-2025',
    icon: 'folder',
    color: '#60a5fa',
    position: 3
  },
  {
    id: 'trades-april-2025',
    name: 'April 2025',
    parentId: 'trades-2025',
    icon: 'folder',
    color: '#60a5fa',
    position: 4
  },
  {
    id: 'trades-may-2025',
    name: 'May 2025',
    parentId: 'trades-2025',
    icon: 'folder',
    color: '#60a5fa',
    position: 5
  },
  {
    id: 'trades-june-2025',
    name: 'June 2025',
    parentId: 'trades-2025',
    icon: 'folder',
    color: '#60a5fa',
    position: 6
  },
  {
    id: 'trades-july-2025',
    name: 'July 2025',
    parentId: 'trades-2025',
    icon: 'folder',
    color: '#60a5fa',
    position: 7
  },
  {
    id: 'trades-august-2025',
    name: 'August 2025',
    parentId: 'trades-2025',
    icon: 'folder',
    color: '#60a5fa',
    position: 8
  },
  {
    id: 'trades-september-2025',
    name: 'September 2025',
    parentId: 'trades-2025',
    icon: 'folder',
    color: '#60a5fa',
    position: 9
  },
  {
    id: 'trades-october-2025',
    name: 'October 2025',
    parentId: 'trades-2025',
    icon: 'folder',
    color: '#60a5fa',
    position: 10
  },
  {
    id: 'trades-november-2025',
    name: 'November 2025',
    parentId: 'trades-2025',
    icon: 'folder',
    color: '#60a5fa',
    position: 11
  },
  {
    id: 'archives',
    name: 'Archives',
    parentId: 'trading-journal',
    icon: 'archive',
    color: '#9ca3af',
    description: 'Older trades and historical data',
    position: 2
  },

  // Research subfolders
  {
    id: 'sectors',
    name: 'Sector Analysis',
    parentId: 'research',
    icon: 'folder',
    color: '#a78bfa',
    description: 'Industry and sector research',
    position: 1
  },
  {
    id: 'companies',
    name: 'Company Research',
    parentId: 'research',
    icon: 'folder',
    color: '#a78bfa',
    description: 'Individual company analysis',
    position: 2
  },
  {
    id: 'economic-data',
    name: 'Economic Data',
    parentId: 'research',
    icon: 'folder',
    color: '#a78bfa',
    description: 'Macroeconomic indicators and analysis',
    position: 3
  }
]

export const SAMPLE_DOCUMENTS: SampleDocument[] = [
  // Trade entries
  {
    id: 'yibo-momentum-trade',
    title: 'YIBO Momentum Breakout Trade',
    folderId: 'trades-january',
    type: 'trade_entry',
    content: `# YIBO Momentum Breakout Trade

## Entry Details
- **Date**: January 15, 2024
- **Symbol**: YIBO
- **Entry Price**: $12.45
- **Position Size**: 500 shares
- **Total Investment**: $6,225

## Analysis
Strong momentum play based on:
- Breakout above $12.00 resistance
- Volume spike (3x average)
- Biotech sector strength
- FDA approval catalyst expected

## Risk Management
- **Stop Loss**: $11.80 (-5.2%)
- **Target 1**: $14.50 (+16.5%)
- **Target 2**: $16.80 (+35%)
- **Risk/Reward**: 1:3.2

## Trade Notes
Morning gap up on positive news. Clean breakout with strong volume. Entered on the first pullback to support.

## Exit Strategy
- Partial profit at Target 1 (50% position)
- Trail stop for remaining position
- Watch for momentum exhaustion signals

## Result
**Status**: Closed ✅
**Exit Price**: $15.20
**Profit**: $1,375 (+22.1%)
**Hold Time**: 8 days

## Lessons Learned
- Momentum plays work best with volume confirmation
- Taking partial profits preserved gains when stock pulled back
- Biotech volatility requires tighter risk management`,
    tags: ['momentum', 'biotech', 'breakout', 'short-term'],
    createdAt: '2024-01-15T09:30:00Z',
    updatedAt: '2024-01-23T16:45:00Z'
  },

  {
    id: 'lpo-swing-trade',
    title: 'LPO Support Bounce Strategy',
    folderId: 'trades-january',
    type: 'trade_entry',
    content: `# LPO Support Bounce Strategy

## Entry Details
- **Date**: January 22, 2024
- **Symbol**: LPO
- **Entry Price**: $28.30
- **Position Size**: 200 shares
- **Total Investment**: $5,660

## Setup Analysis
Support level bounce play:
- Testing $28.00 support (3rd time)
- RSI oversold (32)
- Bullish divergence on MACD
- Previous resistance now support

## Technical Levels
- **Support**: $28.00
- **Resistance 1**: $31.50
- **Resistance 2**: $34.00
- **Stop Loss**: $27.60 (-2.5%)

## Fundamental Backdrop
- Strong earnings last quarter
- Institutional buying interest
- Sector rotation into value plays
- Dividend yield attractive at 3.2%

## Position Management
Planning to hold for 2-4 weeks targeting $32-34 range.

## Updates
**Day 3**: Holding above $28.50, looking for breakout above $30
**Day 7**: Breaking through $31, raising stop to $29.50

## Result
**Status**: Open 🟡
**Current Price**: $31.75
**Unrealized P&L**: +$690 (+12.2%)`,
    tags: ['swing-trade', 'support-bounce', 'value', 'medium-term'],
    createdAt: '2024-01-22T14:20:00Z',
    updatedAt: '2024-01-29T11:30:00Z'
  },

  // Strategy documents
  {
    id: 'momentum-strategy',
    title: 'Momentum Breakout Strategy',
    folderId: 'strategies',
    type: 'strategy',
    content: `# Momentum Breakout Strategy

## Overview
A systematic approach to trading momentum breakouts in high-volume situations with strong catalysts.

## Entry Criteria
1. **Price Action**
   - Clear breakout above significant resistance
   - Volume at least 2x 20-day average
   - Minimum 3% move from resistance level

2. **Market Conditions**
   - Strong overall market trend
   - Sector showing relative strength
   - No major market events pending

3. **Fundamental Catalyst**
   - Earnings beat
   - FDA approval
   - Partnership announcement
   - Analyst upgrade

## Risk Management
- **Position Size**: Maximum 2% of portfolio per trade
- **Stop Loss**: 5-8% below entry
- **Time Stop**: Exit if no progress in 10 trading days

## Profit Taking
- **First Target**: 15-20% gain (sell 50%)
- **Second Target**: 30-40% gain (sell 25%)
- **Runner**: Trail stop for final 25%

## Market Conditions
**Best Markets**: Strong uptrend, low VIX (<20)
**Avoid**: High volatility periods, bearish market

## Backtesting Results
- **Win Rate**: 65%
- **Average Win**: +18.5%
- **Average Loss**: -6.2%
- **Risk/Reward**: 1:3.0
- **Profit Factor**: 2.8

## Recent Performance
- **Last 10 trades**: 7 wins, 3 losses
- **Total P&L**: +$12,450
- **Best Trade**: YIBO (+22.1%)
- **Worst Trade**: BIOQ (-7.8%)

## Rules Refinements
1. Added volume filter after poor results in low-volume breakouts
2. Reduced position size in biotech (higher volatility)
3. Tightened stops during earnings season`,
    tags: ['momentum', 'breakout', 'systematic', 'high-probability'],
    createdAt: '2024-01-10T10:00:00Z',
    updatedAt: '2024-01-30T15:45:00Z'
  },

  {
    id: 'support-resistance-rules',
    title: 'Support & Resistance Trading Rules',
    folderId: 'strategies',
    type: 'strategy',
    content: `# Support & Resistance Trading Rules

## Core Principles
Support and resistance levels represent areas where buying and selling pressure balance out, creating reliable trading opportunities.

## Identifying Key Levels
1. **Horizontal Levels**
   - Previous swing highs/lows
   - Round numbers ($50, $100, etc.)
   - Previous breakout points
   - Volume-weighted levels

2. **Dynamic Levels**
   - 20, 50, 200-day moving averages
   - Trend lines
   - Fibonacci retracements
   - Bollinger Band boundaries

## Trading Rules

### Support Bounces
- **Entry**: Near support with rejection candle
- **Stop**: 2-3% below support level
- **Target**: Previous resistance or 2:1 R/R

### Resistance Breakouts
- **Entry**: 1-2% above resistance on volume
- **Stop**: Back below resistance level
- **Target**: Next resistance or measured move

### Failed Breaks
- **Short Setup**: When price fails to hold breakout
- **Entry**: Below breakdown level
- **Stop**: Back above resistance
- **Target**: Next support level

## Confirmation Signals
- Volume increase on breakout/breakdown
- RSI divergence at levels
- Multiple timeframe alignment
- Candlestick patterns (hammer, doji, engulfing)

## Examples from Recent Trades
1. **LPO Support Bounce**: $28.00 level held 3 times
2. **NVDA Resistance Break**: $480 level broken on earnings
3. **TSLA Failed Break**: $250 resistance rejection

## Common Mistakes to Avoid
- Trading every level (wait for best setups)
- Ignoring volume confirmation
- Not respecting stops when wrong
- Over-leveraging near key levels`,
    tags: ['support-resistance', 'technical-analysis', 'systematic'],
    createdAt: '2024-01-08T09:15:00Z',
    updatedAt: '2024-01-25T14:20:00Z'
  },

  // Research documents
  {
    id: 'biotech-analysis',
    title: 'Biotech Sector Q1 2024 Analysis',
    folderId: 'sectors',
    type: 'research',
    content: `# Biotech Sector Analysis - Q1 2024

## Sector Overview
The biotech sector (XBI) has shown resilience in Q1 despite broader market volatility, driven by several FDA approvals and strong pipeline developments.

## Key Trends
1. **FDA Approvals Accelerating**
   - 12 new drug approvals in Q1 vs 8 in Q1 2023
   - Faster review times for breakthrough therapies
   - Increased priority for rare disease treatments

2. **Funding Environment Improving**
   - Biotech IPOs up 40% QoQ
   - Venture funding returning to sector
   - Strategic partnerships increasing

3. **AI/ML Integration**
   - Drug discovery acceleration
   - Clinical trial optimization
   - Regulatory submission improvements

## Top Holdings Analysis

### GILD (Gilead Sciences)
- **Price**: $78.50
- **Market Cap**: $98B
- **Catalyst**: New HIV drug launch
- **Risk**: Patent cliff concerns

### BIIB (Biogen)
- **Price**: $245.20
- **Market Cap**: $35B
- **Catalyst**: Alzheimer's drug approval
- **Risk**: Competitive landscape

### REGN (Regeneron)
- **Price**: $890.30
- **Market Cap**: $96B
- **Catalyst**: Obesity drug pipeline
- **Risk**: High valuation

## Upcoming Catalysts
- **March 15**: ADMA FDA decision
- **April 2**: BMRN earnings
- **April 20**: SAGE Phase 3 data
- **May 5**: ALNY investor day

## Sector Risks
1. Regulatory changes
2. Drug pricing pressure
3. Clinical trial failures
4. Market sentiment shifts

## Investment Thesis
Cautiously optimistic on sector with focus on:
- Large-cap stable names (GILD, BIIB)
- Specific catalyst plays (small-cap with near-term approvals)
- Diversified exposure through XBI ETF

## Position Sizing Recommendations
- Maximum 15% portfolio allocation
- Individual positions capped at 3%
- Higher cash allocation for volatility`,
    tags: ['biotech', 'sector-analysis', 'FDA', 'pharmaceuticals'],
    createdAt: '2024-01-28T11:00:00Z',
    updatedAt: '2024-01-30T16:30:00Z'
  },

  // Review documents
  {
    id: 'january-review',
    title: 'January 2024 Trading Review',
    folderId: 'reviews',
    type: 'review',
    content: `# January 2024 Trading Review

## Performance Summary
- **Total P&L**: +$8,450 (+4.2% portfolio)
- **Win Rate**: 70% (7 wins, 3 losses)
- **Best Trade**: YIBO (+$1,375)
- **Worst Trade**: SOFI (-$650)
- **Average Hold Time**: 6.5 days

## Trades Executed
| Symbol | Entry | Exit | P&L | Hold Days | Strategy |
|--------|--------|------|-----|-----------|----------|
| YIBO | $12.45 | $15.20 | +$1,375 | 8 | Momentum |
| LPO | $28.30 | Open | +$690 | 9 | Support Bounce |
| NVDA | $485.20 | $510.50 | +$2,530 | 3 | Earnings Play |
| SOFI | $7.80 | $7.15 | -$650 | 5 | Failed Breakout |
| AAPL | $190.50 | $195.80 | +$1,060 | 4 | Swing Trade |

## Strategy Performance
1. **Momentum Breakouts**: 3/4 wins (+$3,255)
2. **Support/Resistance**: 2/3 wins (+$1,750)
3. **Earnings Plays**: 1/1 win (+$2,530)
4. **Failed Trades**: 3 losses (-$1,485)

## What Worked Well
- Strong momentum plays with volume confirmation
- Taking partial profits preserved gains
- Quick exits on failed setups
- Sector rotation timing (tech earnings)

## Areas for Improvement
1. **Position Sizing**: Was too aggressive on SOFI trade
2. **Risk Management**: Held losers too long (SOFI, PLTR)
3. **Market Timing**: Entered defensive during strong market

## Key Lessons
- Volume is critical for momentum plays
- Don't fight strong market trends
- Biotech requires smaller position sizes
- Earnings season offers great opportunities

## February Goals
1. Increase win rate to 75%
2. Improve average R/R to 1:2.5
3. Focus on highest probability setups only
4. Better position sizing discipline

## Portfolio Adjustments
- Reduce biotech exposure from 20% to 15%
- Increase tech allocation for earnings season
- Build larger cash position for opportunities
- Add defensive positions if market shows weakness

## Market Outlook
Bullish bias for February with focus on:
- Earnings momentum in tech
- Fed policy clarity
- Sector rotation opportunities
- Individual stock catalysts`,
    tags: ['performance-review', 'monthly', 'analysis', 'goals'],
    createdAt: '2024-02-01T09:00:00Z',
    updatedAt: '2024-02-01T17:30:00Z'
  },

  // Template documents
  {
    id: 'trade-analysis-template',
    title: 'Trade Analysis Template',
    folderId: 'templates',
    type: 'template',
    content: `# Trade Analysis Template

## Basic Information
- **Date**: [Entry Date]
- **Symbol**: [Ticker]
- **Entry Price**: $[Price]
- **Position Size**: [Shares/Contracts]
- **Total Investment**: $[Amount]

## Setup Analysis
**Strategy**: [Momentum/Swing/Scalp/etc.]

**Technical Setup**:
- Chart pattern: [Breakout/Bounce/Reversal]
- Key levels: Support $[X], Resistance $[Y]
- Indicators: [RSI, MACD, Volume, etc.]
- Timeframe: [Daily/Hourly/etc.]

**Fundamental Catalyst** (if applicable):
- [Earnings/News/FDA approval/etc.]

## Risk Management
- **Stop Loss**: $[Price] ([%] loss)
- **Target 1**: $[Price] ([%] gain)
- **Target 2**: $[Price] ([%] gain)
- **Risk/Reward Ratio**: 1:[X]
- **Position Size Justification**: [% of portfolio, volatility considerations]

## Trade Thesis
[Detailed explanation of why this trade makes sense]

## Market Context
- **Overall Market**: [Bullish/Bearish/Neutral]
- **Sector Strength**: [Strong/Weak/Neutral]
- **VIX Level**: [Low/Medium/High volatility]
- **Economic Environment**: [Any relevant macro factors]

## Trade Management Plan
- **Partial Profit Strategy**: [When and how much to take off]
- **Stop Adjustment Rules**: [When to move stops]
- **Time Stops**: [Maximum hold time]
- **News/Event Risks**: [Earnings, Fed meetings, etc.]

## Daily Updates
**Day 1**: [Price action, volume, any news]
**Day 2**: [Progress toward targets, any adjustments]
[Continue as needed...]

## Final Results
- **Exit Date**: [Date]
- **Exit Price**: $[Price]
- **Total P&L**: $[Amount] ([%])
- **Hold Time**: [X] days
- **Actual vs Expected**: [How did it compare to plan]

## Lessons Learned
**What Went Right**:
- [List successful aspects]

**What Could Be Improved**:
- [Areas for improvement]

**Key Takeaways**:
- [Main lessons for future trades]

## Strategy Refinements
[Any adjustments to make to strategy based on this trade]`,
    tags: ['template', 'trade-analysis', 'systematic'],
    createdAt: '2024-01-05T10:00:00Z',
    updatedAt: '2024-01-20T14:15:00Z'
  },

  {
    id: 'monthly-review-template',
    title: 'Monthly Review Template',
    folderId: 'templates',
    type: 'template',
    content: `# [Month Year] Trading Review

## Performance Summary
- **Total P&L**: $[Amount] ([%] of portfolio)
- **Number of Trades**: [X]
- **Win Rate**: [%] ([X] wins, [Y] losses)
- **Average Win**: +$[Amount] (+[%])
- **Average Loss**: -$[Amount] (-[%])
- **Best Trade**: [Symbol] (+$[Amount])
- **Worst Trade**: [Symbol] (-$[Amount])
- **Average Hold Time**: [X] days
- **Sharpe Ratio**: [X.XX]

## Trade Breakdown
| Symbol | Entry Date | Exit Date | Entry Price | Exit Price | P&L | % Gain/Loss | Strategy | Hold Days |
|--------|------------|-----------|-------------|------------|-----|-------------|----------|-----------|
| [SYMBOL] | [Date] | [Date] | $[Price] | $[Price] | $[Amount] | [%] | [Strategy] | [Days] |

## Strategy Performance Analysis
1. **[Strategy Name]**: [X/Y] wins, $[P&L], [%] win rate
2. **[Strategy Name]**: [X/Y] wins, $[P&L], [%] win rate
3. **[Strategy Name]**: [X/Y] wins, $[P&L], [%] win rate

## Market Environment
- **Market Direction**: [Bull/Bear/Sideways]
- **Average VIX**: [Level]
- **Sector Leaders**: [List top performing sectors]
- **Major Events**: [Fed meetings, earnings seasons, etc.]

## What Worked Well
1. [Success factor 1]
2. [Success factor 2]
3. [Success factor 3]

## Areas for Improvement
1. **[Area 1]**: [Specific issue and impact]
2. **[Area 2]**: [Specific issue and impact]
3. **[Area 3]**: [Specific issue and impact]

## Key Lessons Learned
- [Lesson 1]
- [Lesson 2]
- [Lesson 3]

## Risk Management Review
- **Largest Loss**: [%] of portfolio
- **Maximum Drawdown**: [%]
- **Position Sizing**: [Average % per trade]
- **Stop Loss Effectiveness**: [% of stops hit vs manual exits]

## Portfolio Allocation Review
- **Cash**: [%]
- **Equities**: [%]
- **Options**: [%]
- **Sector Breakdown**: [List major sectors and %]

## Goals for Next Month
1. **Performance Goal**: [Specific target]
2. **Process Goal**: [Specific improvement]
3. **Risk Goal**: [Specific risk metric]
4. **Learning Goal**: [Skill to develop]

## Strategy Adjustments
- [Adjustment 1 and reasoning]
- [Adjustment 2 and reasoning]
- [Adjustment 3 and reasoning]

## Market Outlook for [Next Month]
**Overall Bias**: [Bullish/Bearish/Neutral]

**Key Events to Watch**:
- [Event 1 and date]
- [Event 2 and date]
- [Event 3 and date]

**Preferred Strategies**:
- [Strategy 1 and reasoning]
- [Strategy 2 and reasoning]

**Sectors to Focus On**:
- [Sector 1]: [Reasoning]
- [Sector 2]: [Reasoning]

## Action Items
- [ ] [Action item 1]
- [ ] [Action item 2]
- [ ] [Action item 3]`,
    tags: ['template', 'monthly-review', 'performance', 'analysis'],
    createdAt: '2024-01-05T10:30:00Z',
    updatedAt: '2024-01-15T16:45:00Z'
  },

  // 2025 Trade Entries for State Testing
  {
    id: 'tsla-january-2025',
    title: 'TSLA Earnings Momentum Trade',
    folderId: 'trades-january-2025',
    type: 'trade_entry',
    content: `# TSLA Earnings Momentum Trade

## Entry Details
- **Date**: January 8, 2025
- **Symbol**: TSLA
- **Entry Price**: $245.30
- **Position Size**: 100 shares
- **Total Investment**: $24,530

## Analysis
Strong momentum play based on:
- Q4 earnings beat expectations
- Model 3 production ramp accelerating
- Cybertruck orders exceeding forecasts
- Breakout above $240 resistance

## Risk Management
- **Stop Loss**: $235.00 (-4.2%)
- **Target 1**: $275.00 (+12.1%)
- **Target 2**: $310.00 (+26.4%)
- **Risk/Reward**: 1:3.1

## Trade Notes
Pre-earnings build-up was strong. Entered on gap up with conviction. Volume 4x average.

## Result
**Status**: Closed ✅
**Exit Price**: $285.40
**Profit**: $4,010 (+16.3%)
**Hold Time**: 12 days

## Lessons Learned
- Earnings momentum plays require early entry
- Tesla volatility warrants tighter stops
- Model 3 success is key driver`,
    tags: ['momentum', 'earnings', 'ev', 'short-term'],
    createdAt: '2025-01-08T09:30:00Z',
    updatedAt: '2025-01-20T16:45:00Z'
  },

  {
    id: 'pltr-february-2025',
    title: 'PLTR AI Software Breakout',
    folderId: 'trades-february-2025',
    type: 'trade_entry',
    content: `# PLTR AI Software Breakout

## Entry Details
- **Date**: February 14, 2025
- **Symbol**: PLTR
- **Entry Price**: $18.75
- **Position Size**: 300 shares
- **Total Investment**: $5,625

## Setup Analysis
AI software breakout play:
- Breaking out of 3-month consolidation
- New government contract announced
- AI sector rotation gaining momentum
- Relative strength vs software sector

## Technical Levels
- **Breakout Level**: $18.00
- **Resistance 1**: $22.50
- **Resistance 2**: $26.00
- **Stop Loss**: $17.80 (-5.1%)

## Fundamental Catalysts
- Department of Defense contract expansion
- Commercial AI adoption accelerating
- Q1 earnings guidance raised
- Institutional buying interest

## Trade Management
Holding through earnings with reduced position size.

## Updates
**Week 1**: Consolidating gains above $20
**Week 2**: Earnings beat, stock surging

## Result
**Status**: Open 🟡
**Current Price**: $24.80
**Unrealized P&L**: +$1,815 (+32.3%)`,
    tags: ['ai-software', 'breakout', 'government-contract', 'medium-term'],
    createdAt: '2025-02-14T11:20:00Z',
    updatedAt: '2025-02-28T14:30:00Z'
  },

  {
    id: 'nvda-march-2025',
    title: 'NVDA Chip Supercycle Trade',
    folderId: 'trades-march-2025',
    type: 'trade_entry',
    content: `# NVDA Chip Supercycle Trade

## Entry Details
- **Date**: March 5, 2025
- **Symbol**: NVDA
- **Entry Price**: $485.60
- **Position Size**: 50 shares
- **Total Investment**: $24,280

## Analysis
AI chip demand supercycle:
- Data center AI accelerator demand exploding
- New Blackwell architecture beating competitors
- China market access improving
- Supply constraints supporting pricing

## Risk Management
- **Stop Loss**: $460.00 (-5.3%)
- **Target 1**: $550.00 (+13.2%)
- **Target 2**: $650.00 (+33.8%)
- **Risk/Reward**: 1:2.8

## Trade Notes
Entered on analyst upgrade. Strong institutional flow detected.

## Result
**Status**: Partially Closed ⚠️
**Exit Price (50%)**: $568.20
**Realized Profit**: $4,130 (+17.0%)
**Remaining Position**: 25 shares
**Current Price**: $589.40`,
    tags: ['ai-chips', 'supercycle', 'data-center', 'long-term'],
    createdAt: '2025-03-05T10:15:00Z',
    updatedAt: '2025-03-25T15:20:00Z'
  },

  {
    id: 'amd-april-2025',
    title: 'AMD AI Competitor Trade',
    folderId: 'trades-april-2025',
    type: 'trade_entry',
    content: `# AMD AI Competitor Trade

## Entry Details
- **Date**: April 18, 2025
- **Symbol**: AMD
- **Entry Price**: $165.80
- **Position Size**: 150 shares
- **Total Investment**: $24,870

## Setup Analysis
AMD AI momentum catching up to NVDA:
- MI300 sales exceeding expectations
- Market share gains in data center
- Server CPU cycle turning positive
- Valuation discount to NVDA narrowing

## Technical Setup
- Ascending triangle pattern
- Breakout above $160 resistance
- Volume confirmation (2.5x average)
- RSI strong but not overbought (68)

## Risk Management
- **Stop Loss**: $155.00 (-6.5%)
- **Target 1**: $185.00 (+11.6%)
- **Target 2**: $210.00 (+26.7%)
- **Position Size**: Reduced due to semi volatility

## Catalyst Timeline
- Q2 earnings (May)
- New AI chip announcements (June)
- Server refresh cycle (Q3)

## Trade Updates
**Week 1**: Strong follow-through buying
**Week 2**: Consolidating above $170

## Result
**Status**: Open 🟡
**Current Price**: $178.90
**Unrealized P&L**: +$1,965 (+7.9%)`,
    tags: ['semiconductors', 'ai-competition', 'data-center', 'medium-term'],
    createdAt: '2025-04-18T13:45:00Z',
    updatedAt: '2025-04-28T11:30:00Z'
  },

  {
    id: 'meta-may-2025',
    title: 'META Metaverse Pivot Trade',
    folderId: 'trades-may-2025',
    type: 'trade_entry',
    content: `# META Metaverse Pivot Trade

## Entry Details
- **Date**: May 10, 2025
- **Symbol**: META
- **Entry Price**: $425.30
- **Position Size**: 60 shares
- **Total Investment**: $25,518

## Thesis Analysis
Metaverse investment paying off:
- Reality Labs losses narrowing
- Horizon Worlds user growth accelerating
- Enterprise metaverse adoption starting
- Advertising business still strong

## Fundamental Metrics
- P/E: 22.5 (reasonable for growth)
- Revenue growth: 18% YoY
- Free cash flow: $45B annually
- Metaverse ARPU growing 45%

## Risk Management
- **Stop Loss**: $395.00 (-7.1%)
- **Target 1**: $485.00 (+14.1%)
- **Target 2**: $550.00 (+29.3%)
- **Time Horizon**: 6-12 months

## Technical Analysis
- Cup and handle pattern forming
- 200-day moving average support at $380
- Volume drying up (bullish sign)
- Institutional accumulation detected

## Catalysts
- Q2 earnings report (July)
- New VR headset launch (August)
- Enterprise partnerships announcements

## Result
**Status**: Open 🟡
**Current Price**: $448.70
**Unrealized P&L**: +$1,404 (+5.5%)`,
    tags: ['metaverse', 'vr-ar', 'social-media', 'long-term'],
    createdAt: '2025-05-10T10:30:00Z',
    updatedAt: '2025-05-28T16:20:00Z'
  },

  {
    id: 'aapl-june-2025',
    title: 'AAPL iPhone 16 Supercycle Trade',
    folderId: 'trades-june-2025',
    type: 'trade_entry',
    content: `# AAPL iPhone 16 Supercycle Trade

## Entry Details
- **Date**: June 3, 2025
- **Symbol**: AAPL
- **Entry Price**: $178.90
- **Position Size**: 140 shares
- **Total Investment**: $25,046

## Investment Thesis
iPhone 16 upgrade supercycle beginning:
- AI features driving replacement demand
- China market share recovering
- Services growth accelerating
- New product categories launching

## Key Catalysts
- WWDC announcements (AI integration)
- iPhone 16 pre-orders (September)
- China 5G rollout completion
- Vision Pro sales ramping

## Financial Metrics
- P/E: 28.5 (premium but justified)
- Dividend yield: 0.5%
- Buyback: $90B annual program
- Cash: $62B

## Technical Analysis
- Breaking out of 6-month base
- Relative strength vs S&P 500
- Volume increasing on up days
- Options flow bullish

## Risk Management
- **Stop Loss**: $165.00 (-7.8%)
- **Target 1**: $195.00 (+9.0%)
- **Target 2**: $220.00 (+22.9%)
- **Position Size**: Core holding (5% of portfolio)

## Trade Plan
- Add to position on any weakness
- Hold through iPhone 16 launch
- Take partial profits at $200

## Result
**Status**: Open 🟡
**Current Price**: $186.40
**Unrealized P&L**: +$1,050 (+4.2%)`,
    tags: ['iphone', 'apple-ecosystem', 'ai-features', 'consumer-tech'],
    createdAt: '2025-06-03T09:45:00Z',
    updatedAt: '2025-06-25T14:15:00Z'
  },

  {
    id: 'cof-july-2025',
    title: 'COF Banking Recovery Trade',
    folderId: 'trades-july-2025',
    type: 'trade_entry',
    content: `# COF Banking Recovery Trade

## Entry Details
- **Date**: July 15, 2025
- **Symbol**: COF
- **Entry Price**: $98.45
- **Position Size**: 250 shares
- **Total Investment**: $24,613

## Setup Analysis
Regional banking recovery play:
- Interest rate expectations easing
- Loan growth resuming
- Credit quality stable
- Valuation attractive (P/E 9.2)

## Technical Pattern
- Double bottom at $88
- Breakout above $95 resistance
- 50-day moving average crossing above 200-day
- Volume confirmation on breakout

## Risk Management
- **Stop Loss**: $92.00 (-6.6%)
- **Target 1**: $110.00 (+11.7%)
- **Target 2**: $125.00 (+26.9%)
- **Position Size**: Sector diversification

## Fundamental Drivers
- Net interest margins stabilizing
- Credit card spending growing
- Cost reduction initiatives working
- Digital banking investments paying off

## Economic Context
- Fed expected to cut rates in H2
- Consumer spending resilient
- Business investment improving
- Inflation moderating

## Result
**Status**: Open 🟡
**Current Price**: $106.80
**Unrealized P&L**: +$2,088 (+8.5%)`,
    tags: ['banking', 'regional-banks', 'interest-rates', 'value-play'],
    createdAt: '2025-07-15T11:30:00Z',
    updatedAt: '2025-07-29T10:45:00Z'
  },

  {
    id: 'baba-august-2025',
    title: 'BABA China Reopening Trade',
    folderId: 'trades-august-2025',
    type: 'trade_entry',
    content: `# BABA China Reopening Trade

## Entry Details
- **Date**: August 8, 2025
- **Symbol**: BABA
- **Entry Price**: $87.30
- **Position Size**: 285 shares
- **Total Investment**: $24,881

## Investment Thesis
China consumer recovery accelerating:
- Government stimulus working
- Consumer confidence improving
- Alibaba's competitive position strengthening
- Valuation extremely compelling

## Key Metrics
- P/E: 12.1 (historically cheap)
- Revenue growth: 7% YoY (accelerating)
- Cloud market share: 38% (stable)
- Free cash flow yield: 6.8%

## Technical Analysis
- Breaking 2-year downtrend
- Relative strength vs Chinese tech
- Volume increasing steadily
- MACD bullish crossover

## Risk Management
- **Stop Loss**: $78.00 (-10.7%)
- **Target 1**: $98.00 (+12.2%)
- **Target 2**: $115.00 (+31.7%)
- **Currency Risk**: USD/CNH hedged

## Catalysts
- Q2 earnings (September)
- New cloud AI partnerships
- Cross-border e-commerce growth
- Potential government support

## Trade Strategy
- Build position gradually
- Hold through Chinese New Year season
- Take profits on upgrades

## Result
**Status**: Open 🟡
**Current Price**: $91.60
**Unrealized P&L**: +$1,226 (+4.9%)`,
    tags: ['china-tech', 'consumer-recovery', 'e-commerce', 'emerging-markets'],
    createdAt: '2025-08-08T10:15:00Z',
    updatedAt: '2025-08-28T15:30:00Z'
  },

  {
    id: 'tsla-september-2025',
    title: 'TSLA Robotaxi Announcement Trade',
    folderId: 'trades-september-2025',
    type: 'trade_entry',
    content: `# TSLA Robotaxi Announcement Trade

## Entry Details
- **Date**: September 12, 2025
- **Symbol**: TSLA
- **Entry Price**: $298.50
- **Position Size**: 85 shares
- **Total Investment**: $25,373

## Catalyst Analysis
Robotaxi commercial launch imminent:
- Regulatory approvals progressing
- Safety data exceeding expectations
- Fleet expansion plans announced
- Revenue model showing promise

## Business Impact
- Potential $50B revenue by 2028
- 80% gross margins on robotaxi service
- Network effects creating moat
- Tesla energy synergies

## Technical Setup
- Ascending channel pattern
- Breakout above $285 resistance
- Options flow showing bullish bets
- Institutional buying returning

## Risk Management
- **Stop Loss**: $275.00 (-7.8%)
- **Target 1**: $340.00 (+13.9%)
- **Target 2**: $420.00 (+40.7%)
- **Position Size**: Speculative allocation (3% of portfolio)

## Timeline
- October: Robotaxi service launch in LA
- Q4: Expansion to 5 more cities
- 2026: International rollout begins
- 2027: Full self-driving approval expected

## Competitive Advantages
- Real-world driving data advantage
- Vertical integration (chips to software)
- Manufacturing scale
- Supercharger network integration

## Result
**Status**: Open 🟡
**Current Price**: $315.80
**Unrealized P&L**: +$1,471 (+5.8%)`,
    tags: ['robotaxi', 'autonomous-vehicles', 'disruptive-tech', 'speculative'],
    createdAt: '2025-09-12T14:20:00Z',
    updatedAt: '2025-09-25T11:45:00Z'
  },

  {
    id: 'amzn-october-2025',
    title: 'AMZN AI Cloud Computing Trade',
    folderId: 'trades-october-2025',
    type: 'trade_entry',
    content: `# AMZN AI Cloud Computing Trade

## Entry Details
- **Date**: October 7, 2025
- **Symbol**: AMZN
- **Entry Price**: $145.80
- **Position Size**: 170 shares
- **Total Investment**: $24,786

## Investment Thesis
AWS benefiting from AI explosion:
- AI training workload dominance
- New AI services driving higher margins
- Enterprise migration accelerating
- Custom AI chip advantages

## AWS Growth Drivers
- AI/ML revenue up 89% YoY
- Generative AI services launching monthly
- Enterprise contracts larger and longer
- Cost advantages vs competitors

## Technical Analysis
- Breaking out of 8-month consolidation
- Relative strength vs mega-cap tech
- Options flow showing call buying
- Volume confirming breakout

## Risk Management
- **Stop Loss**: $135.00 (-7.4%)
- **Target 1**: $165.00 (+13.2%)
- **Target 2**: $185.00 (+26.8%)
- **Position Size**: Core tech holding

## Business Segments Performance
- AWS: 22% revenue growth, 35% margin
- E-commerce: 9% growth, improving profitability
- Advertising: 24% growth, high margin
- Other segments: Break-even to profitable

## Catalysts
- Q3 earnings (October)
- New AI service announcements
- Prime user growth acceleration
- International expansion

## Result
**Status**: Open 🟡
**Current Price**: $152.60
**Unrealized P&L**: +$1,156 (+4.7%)`,
    tags: ['cloud-computing', 'ai-infrastructure', 'aws', 'mega-cap-tech'],
    createdAt: '2025-10-07T09:30:00Z',
    updatedAt: '2025-10-28T16:10:00Z'
  },

  {
    id: 'msft-november-2025',
    title: 'MSFT OpenAI Partnership Trade',
    folderId: 'trades-november-2025',
    type: 'trade_entry',
    content: `# MSFT OpenAI Partnership Trade

## Entry Details
- **Date**: November 15, 2025
- **Symbol**: MSFT
- **Entry Price**: $385.20
- **Position Size**: 65 shares
- **Total Investment**: $25,038

## Strategic Advantage
Microsoft's OpenAI partnership creating moat:
- Azure OpenAI service exclusive
- Copilot integration across products
- Enterprise AI deployment leader
- First-mover advantage in AGI race

## Business Segments Analysis
- **Cloud**: Azure growth 29% YoY (AI driving)
- **Productivity**: Office 365 Copilot monetization
- **Gaming**: Activision integration synergies
- **LinkedIn**: AI-powered recruitment tools

## AI Monetization Path
- Copilot: $30/user/month enterprise
- Azure OpenAI: $2B+ run-rate
- GitHub Copilot: 1.3M paying users
- Search: Bing market share gaining

## Risk Management
- **Stop Loss**: $360.00 (-6.5%)
- **Target 1**: $430.00 (+11.6%)
- **Target 2**: $480.00 (+24.6%)
- **Position Size**: diversified tech exposure

## Financial Metrics
- P/E: 32.1 (premium for AI growth)
- Revenue growth: 15% YoY
- Cloud gross margin: 72% (improving)
- Free cash flow: $78B annually

## Competitive Positioning
- AWS alternative with AI advantage
- Google Cloud lagging in AI integration
- IBM Watson struggling to compete
- Enterprise trust and relationships key

## Result
**Status**: Open 🟡
**Current Price**: $398.70
**Unrealized P&L**: +$878 (+3.5%)`,
    tags: ['ai-partnership', 'cloud-computing', 'enterprise-software', 'microsoft-ecosystem'],
    createdAt: '2025-11-15T10:45:00Z',
    updatedAt: '2025-11-25T14:20:00Z'
  },

  {
    id: 'trade-2025-11-30',
    parentId: 'november-2025',
    icon: 'document',
    color: '#60a5fa',
    title: 'NVDA Trade - Nov 30',
    type: 'trade',
    content: `# NVDA Options Trade - November 30, 2025

## Trade Setup
- **Asset**: NVDA Call Options
- **Strike**: $150.00
- **Expiry**: Dec 19, 2025
- **Entry Price**: $8.45 per contract
- **Contracts**: 10
- **Direction**: Long (Bullish)

## Thesis
- AI chip demand accelerating
- Blackwell production ramp confirmed
- Data center spending increasing
- Technical breakout above resistance
- Options flow showing institutional buying

## Risk Management
- **Stop Loss**: $5.20 (-38.5%)
- **Target 1**: $12.50 (+48.0%)
- **Target 2**: $15.80 (+87.0%)
- **Risk/Reward**: 1:2.3

## Trade Notes
Entered on strong AI momentum news. Implied volatility elevated but justified given catalysts.

## Result
**Status**: Open 🔵
**Current Price**: $9.25
**P&L**: $+$800 (+9.5%)
**Hold Time**: 0 days

## Lessons Learned
- AI sector momentum plays require tight risk management
- Options premium decay is significant risk factor
- Institutional flow analysis key for timing`,
    tags: ['ai', 'options', 'momentum', 'tech', 'open'],
    createdAt: '2025-11-30T10:30:00Z',
    updatedAt: '2025-11-30T16:45:00Z'
  }
]

// Helper function to get documents by folder
export function getDocumentsByFolder(folderId: string): SampleDocument[] {
  return SAMPLE_DOCUMENTS.filter(doc => doc.folderId === folderId)
}

// Helper function to get folder hierarchy
export function getFolderHierarchy(): SampleFolder[] {
  const folderMap = new Map<string, SampleFolder & { children: SampleFolder[] }>()

  // Create map with children arrays
  SAMPLE_FOLDERS.forEach(folder => {
    folderMap.set(folder.id, { ...folder, children: [] })
  })

  // Build hierarchy
  const rootFolders: SampleFolder[] = []
  SAMPLE_FOLDERS.forEach(folder => {
    if (folder.parentId) {
      const parent = folderMap.get(folder.parentId)
      if (parent) {
        parent.children.push(folder)
      }
    } else {
      rootFolders.push(folder)
    }
  })

  return rootFolders
}

// Helper function to get folder path
export function getFolderPath(folderId: string): string {
  const folder = SAMPLE_FOLDERS.find(f => f.id === folderId)
  if (!folder) return ''

  if (!folder.parentId) return folder.name

  const parentPath = getFolderPath(folder.parentId)
  return `${parentPath} / ${folder.name}`
}