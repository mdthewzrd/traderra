// Utility function to convert markdown to HTML
export function markdownToHtml(markdown: string): string {
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