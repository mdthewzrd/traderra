import '../../styles/charts-terminal.css'

/**
 * Charts layout — no footer, no Renata sidebar.
 * Override body styles from globals.css to match charts-terminal requirements:
 * body must be display:flex, flex-direction:column, height:100%, overflow:hidden.
 */
export default function ChartsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        html, body { height: 100% !important; overflow: hidden !important; }
        body { display: flex !important; flex-direction: column !important; }
      ` }} />
      {children}
    </>
  )
}
