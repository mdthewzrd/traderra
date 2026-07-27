import { redirect } from 'next/navigation'

// /dilution now lives as a tab inside /personality.
export default function Page() {
  redirect('/personality?tab=dilution')
}
