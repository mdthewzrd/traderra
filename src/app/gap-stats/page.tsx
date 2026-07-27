import { redirect } from 'next/navigation'

// /gap-stats now lives as a tab inside /personality.
export default function Page() {
  redirect('/personality?tab=gap-stats')
}
