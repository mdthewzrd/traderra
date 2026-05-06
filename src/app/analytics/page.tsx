'use client'

import { AppLayout } from '@/components/layout/app-layout'

export default function AnalyticsPage() {
  return (
    <AppLayout
      pageClassName="min-h-screen"
      showPageHeader={true}
      pageHeaderContent={
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold studio-text">Advanced Analytics</h1>
          </div>
        </div>
      }
    >
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold studio-text mb-4">Analytics Dashboard</h2>
          <p className="studio-muted">Advanced analytics features coming soon...</p>
        </div>
      </div>
    </AppLayout>
  )
}