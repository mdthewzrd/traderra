'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useLabSync } from '@/hooks/useLabSync'
import { useChartStore } from '@/stores/charts'

const ChartsTerminal = dynamic(() => import('./ChartsTerminal'), { ssr: false })

export default function ChartsClient(props: { userId: string; userName: string; userImage: string }) {
  useLabSync()
  // Wire ?symbol= so 'Open <ticker> chart' links load the right symbol.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sym = params.get('symbol')
    if (sym) useChartStore.getState().setSymbol(sym)
  }, [])
  return <ChartsTerminal {...props} />
}
