/**
 * Charts layout — no footer, no Renata sidebar.
 * Body already has display:flex;flex-direction:column from charts-terminal.css.
 * Just pass children through — don't wrap in any extra div.
 */
export default function ChartsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
