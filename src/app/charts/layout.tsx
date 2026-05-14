/**
 * Charts layout — full-screen, no footer, no Renata sidebar.
 * The charts app is a single-page canvas app that needs the full viewport.
 */

export default function ChartsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {children}
    </div>
  )
}
