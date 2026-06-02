'use client'

import dynamic from 'next/dynamic'

const ChartsTerminal = dynamic(() => import('./ChartsTerminal'), { ssr: false })

export default function ChartsClient(props: { userId: string; userName: string; userImage: string }) {
  return <ChartsTerminal {...props} />
}
