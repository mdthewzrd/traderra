'use client'

import { useState } from 'react'
import { X, Download, Upload, Check } from 'lucide-react'
import { useChatContext } from '@/contexts/TraderraContext'

interface ImportGuideModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ImportGuideModal({ isOpen, onClose }: ImportGuideModalProps) {
  const { isSidebarOpen: aiSidebarOpen } = useChatContext()

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm"
        style={{ top: '64px' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-[1001] flex items-center justify-center p-4 pointer-events-none"
        style={{ top: '64px' }}
      >
        <div className="pointer-events-auto relative w-full max-w-2xl max-h-[90vh] mx-4 studio-surface rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#1a1a1a]">
          <div>
            <h2 className="text-xl font-semibold studio-text">Import Your Trading Data</h2>
            <p className="text-sm studio-muted mt-1">Get your trades from TraderVue in 3 easy steps</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors"
          >
            <X className="h-5 w-5 studio-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[calc(90vh-200px)] overflow-y-auto">
          <div className="space-y-6">
            {/* Step 1 */}
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-semibold">
                1
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold studio-text mb-2">Go to TraderVue</h3>
                <p className="studio-muted mb-3">Log into your TraderVue account and navigate to your Trades page.</p>
                <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#1a1a1a]">
                  <p className="text-sm studio-text">
                    📱 <span className="text-primary font-medium">TraderVue.com</span> → Trades → Export
                  </p>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-semibold">
                2
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold studio-text mb-2">Download Your Data</h3>
                <p className="studio-muted mb-3">Click the <strong>Export</strong> or <strong>Download</strong> button. TraderVue will automatically include all the columns Traderra needs.</p>

                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-3">
                  <div className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <p className="text-sm text-green-400 font-medium">
                      No need to customize columns - the default export works perfectly!
                    </p>
                  </div>
                </div>

                <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#1a1a1a]">
                  <p className="text-sm studio-text">
                    💾 Look for: <span className="text-primary font-mono">trades.csv</span> in your Downloads folder
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-semibold">
                3
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold studio-text mb-2">Import to Traderra</h3>
                <p className="studio-muted mb-3">Come back to Traderra and click the <strong>Import</strong> button, then select your CSV file.</p>

                <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#1a1a1a]">
                  <div className="flex items-center justify-between">
                    <p className="text-sm studio-text">
                      🚀 <span className="text-primary font-medium">Import Button</span> → Select <span className="font-mono">trades.csv</span>
                    </p>
                    <Upload className="h-4 w-4 text-primary" />
                  </div>
                </div>
              </div>
            </div>

            {/* Benefits */}
            <div className="bg-gradient-to-r from-primary/10 to-blue-500/10 rounded-lg p-6 border border-primary/20">
              <h4 className="text-lg font-semibold studio-text mb-3">What You'll Get:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center space-x-2">
                  <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm studio-text">Complete trading history</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm studio-text">Real performance metrics</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm studio-text">Risk analysis & R-multiples</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm studio-text">AI-powered insights</span>
                </div>
              </div>
            </div>

            {/* Troubleshooting */}
            <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#1a1a1a]">
              <h4 className="text-sm font-semibold studio-text mb-2">Need Help?</h4>
              <p className="text-xs studio-muted">
                If you don't see an Export button, try refreshing TraderVue or check their Help section.
                Most platforms have the export feature under "Tools" or "Settings".
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="text-sm studio-muted">
            Ready to import your data?
          </div>
          <button onClick={onClose} className="btn-primary">
            Got it, let's import!
          </button>
        </div>
      </div>
      </div>
    </>
  )
}