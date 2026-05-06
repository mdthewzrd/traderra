# Traderra Rich Text Editor

A comprehensive Notion-like rich text editor built specifically for trading journals and analysis. Built with TipTap (ProseMirror) and React, featuring trading-specific blocks, templates, and AI-enhanced functionality.

## Features

### 🎯 Core Editor Features
- **Rich Text Editing**: Full formatting support (bold, italic, headings, lists, etc.)
- **Block-based Architecture**: Notion-like slash commands for inserting different content types
- **Real-time Collaboration**: Built for future collaborative editing features
- **Auto-save**: Automatic document saving with conflict resolution
- **Document Management**: Organize, search, and version control documents
- **Dark Theme**: Professionally designed dark theme matching Traderra's design system

### 📊 Trading-Specific Features
- **Trade Entry Blocks**: Structured trade data with P&L calculations
- **Chart Blocks**: Interactive trading charts with technical indicators
- **Calculation Blocks**: Financial formulas with real-time results
- **Document Templates**: Pre-built structures for different journal types
- **Performance Analytics**: Built-in metrics and performance tracking

### 🚀 Advanced Features
- **Keyboard Shortcuts**: Extensive keyboard support for power users
- **Export Options**: PDF, Markdown, and JSON export capabilities
- **AI Integration**: Ready for CopilotKit integration (Renata AI)
- **Mobile Responsive**: Optimized for all device sizes
- **Accessibility**: WCAG 2.1 AA compliant

## Quick Start

### Installation

The editor uses TipTap and related dependencies. Install the required packages:

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-link @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header @tiptap/extension-task-list @tiptap/extension-task-item @tiptap/extension-code-block-lowlight @tiptap/extension-placeholder @tiptap/extension-character-count @tiptap/extension-heading @tiptap/extension-text-style @tiptap/extension-color @tiptap/extension-highlight @tiptap/extension-text-align @tiptap/extension-typography @tiptap/extension-dropcursor @tiptap/extension-gapcursor lowlight sonner
```

### Basic Usage

```tsx
import { RichTextEditor, Document } from '@/components/editor'

const MyJournalPage = () => {
  const [document, setDocument] = useState<Document>({
    id: 'doc-1',
    folderId: 'folder-1',
    title: 'My Trading Journal',
    type: 'trade_analysis',
    content: { type: 'doc', content: [] },
    metadata: {
      tags: ['trading', 'analysis'],
      lastModified: new Date().toISOString(),
      wordCount: 0,
      readTime: 0
    }
  })

  const handleSave = async (document: Document) => {
    // Save to your backend
    await api.saveDocument(document)
  }

  return (
    <RichTextEditor
      document={document}
      onChange={(content) => setDocument(prev => ({ ...prev, content }))}
      onSave={handleSave}
    />
  )
}
```

### Using Trading Blocks

```tsx
import { TradeEntryBlock, ChartBlock, CalculationBlock } from '@/components/editor'

// Trade Entry Block
<TradeEntryBlock
  tradeData={{
    id: 'trade-1',
    symbol: 'AAPL',
    side: 'Long',
    entryPrice: 150.00,
    exitPrice: 165.00,
    quantity: 100,
    pnl: 1500,
    // ... other trade data
  }}
  editable={true}
  onEdit={(data) => console.log('Edit trade:', data)}
/>

// Chart Block
<ChartBlock
  config={{
    id: 'chart-1',
    symbol: 'AAPL',
    timeframe: '1d',
    chartType: 'candlestick',
    indicators: ['RSI', 'MACD'],
    // ... other chart config
  }}
  editable={true}
/>

// Calculation Block
<CalculationBlock
  calculation={{
    id: 'calc-1',
    name: 'Position Size',
    formula: '(accountSize * riskPercentage) / (entryPrice - stopLoss)',
    variables: { accountSize: 10000, riskPercentage: 0.02 },
    // ... other calculation data
  }}
  editable={true}
/>
```

## Component Architecture

### Core Components

#### RichTextEditor
The main editor component that orchestrates all functionality.

**Props:**
- `document?: Document` - Current document to edit
- `onChange?: (content: JSONContent) => void` - Content change handler
- `onSave?: (document: Document) => void` - Save handler
- `placeholder?: string` - Placeholder text
- `editable?: boolean` - Whether editor is editable
- `showToolbar?: boolean` - Show/hide toolbar
- `autoSave?: boolean` - Enable auto-save

#### EditorToolbar
Formatting toolbar with all text formatting options.

#### BlockSelector
Slash command menu for inserting different block types.

#### EditorSidebar
Document outline and navigation sidebar.

#### DocumentManager
Document metadata management and save status.

### Trading Blocks

#### TradeEntryBlock
Displays structured trade information with:
- Trade details (symbol, side, prices, dates)
- P&L calculations and percentages
- Risk/reward metrics
- Strategy and notes
- Expandable detailed view

#### ChartBlock
Interactive chart component with:
- Multiple chart types (candlestick, line, area, bar)
- Technical indicators
- Timeframe selection
- Fullscreen mode
- Export capabilities

#### CalculationBlock
Financial calculation widget with:
- Formula editor
- Variable inputs
- Real-time calculations
- Multiple result formats (currency, percentage, ratio)
- Predefined calculation templates

### Document Templates

Pre-built document structures for:
- **Trade Analysis**: Comprehensive trade review template
- **Strategy Document**: Trading strategy documentation
- **Research Note**: Market research and analysis
- **Performance Review**: Monthly/quarterly performance review
- **Quick Note**: Simple note-taking template

## Styling and Theming

The editor uses Traderra's dark theme design system with:
- **Colors**: Dark backgrounds (#0a0a0a, #111111) with gold accents (#FFD700)
- **Typography**: Inter for UI, JetBrains Mono for code
- **Shadows**: Multi-layer shadow system for depth
- **Animations**: Subtle transitions and micro-interactions

### Custom CSS Classes

```css
.studio-bg          /* Main background */
.studio-surface     /* Card/surface background */
.studio-border      /* Border color */
.studio-text        /* Primary text color */
.studio-muted       /* Muted text color */
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + S` | Save document |
| `Ctrl/Cmd + B` | Bold text |
| `Ctrl/Cmd + I` | Italic text |
| `Ctrl/Cmd + U` | Underline text |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Y` | Redo |
| `/` | Open block selector |
| `Esc` | Close block selector |
| `##` + `Space` | Create heading 2 |
| `*` + `Space` | Create bullet list |
| `1.` + `Space` | Create numbered list |
| `[]` + `Space` | Create task list |

## Integration with Traderra

### Folder System Integration
The editor integrates with Traderra's folder management:

```tsx
import { useFolderContent } from '@/hooks/useFolders'

const { items, createContent } = useFolderContent(userId, {
  folderId: selectedFolderId,
  search: searchQuery
})
```

### AI Integration (Renata)
Ready for CopilotKit integration:

```tsx
import { CopilotSidebar } from '@copilotkit/react-ui'

// The editor is designed to work alongside Renata AI
<CopilotSidebar>
  <RenataChat />
</CopilotSidebar>
```

## API Integration

### Save Documents
```tsx
const handleSave = async (document: Document) => {
  try {
    await api.post('/api/documents', {
      ...document,
      content: JSON.stringify(document.content)
    })
  } catch (error) {
    console.error('Save failed:', error)
  }
}
```

### Export Documents
```tsx
const handleExport = async (document: Document, format: 'pdf' | 'markdown' | 'json') => {
  const response = await api.post(`/api/documents/${document.id}/export`, {
    format,
    content: document.content
  })

  // Download the exported file
  const blob = new Blob([response.data])
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${document.title}.${format}`
  a.click()
}
```

## Performance Considerations

### Optimization Strategies
- **Lazy Loading**: Components load on demand
- **Memoization**: Strategic use of React.memo and useMemo
- **Bundle Splitting**: Separate chunks for editor features
- **Image Optimization**: Automatic image compression and lazy loading
- **Auto-save Debouncing**: Prevents excessive save operations

### Bundle Size
- Core editor: ~150KB gzipped
- Trading blocks: ~50KB gzipped
- Templates: ~20KB gzipped
- Total: ~220KB gzipped

## Browser Support

- Chrome 88+ ✅
- Firefox 85+ ✅
- Safari 14+ ✅
- Edge 88+ ✅

## Accessibility

The editor follows WCAG 2.1 AA guidelines:
- **Keyboard Navigation**: Full keyboard support
- **Screen Reader Support**: Proper ARIA labels and descriptions
- **Focus Management**: Logical tab order and focus indicators
- **Color Contrast**: Meets AA contrast requirements
- **Reduced Motion**: Respects prefers-reduced-motion

## Contributing

### Development Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`
4. Visit demo page: `http://localhost:6565/editor-demo`

### Adding New Blocks
1. Create component in `/blocks/` directory
2. Follow the block interface pattern
3. Add to BlockSelector options
4. Update documentation

### Testing
```bash
npm run test           # Run unit tests
npm run test:e2e       # Run end-to-end tests
npm run test:a11y      # Run accessibility tests
```

## Roadmap

### Upcoming Features
- [ ] Real-time collaboration
- [ ] Advanced chart integrations (TradingView)
- [ ] Voice dictation support
- [ ] Advanced AI writing assistance
- [ ] Plugin system for custom blocks
- [ ] Mobile app version

### AI Enhancement Plans
- [ ] Smart content suggestions
- [ ] Automated trade analysis
- [ ] Performance insights generation
- [ ] Strategy recommendation engine

## Support

For questions, issues, or feature requests:
- Create an issue in the repository
- Contact the Traderra development team
- Check the documentation wiki

## License

This rich text editor is part of the Traderra platform and is proprietary software. See LICENSE file for details.