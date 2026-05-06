'use client'

import { Toaster } from 'react-hot-toast'

export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: '#111111',
          color: '#e5e5e5',
          border: '1px solid #1a1a1a',
          borderRadius: '0.75rem',
          fontSize: '14px',
        },
        success: {
          iconTheme: {
            primary: '#10b981',
            secondary: '#111111',
          },
        },
        error: {
          iconTheme: {
            primary: '#ef4444',
            secondary: '#111111',
          },
        },
        loading: {
          iconTheme: {
            primary: '#3b82f6',
            secondary: '#111111',
          },
        },
      }}
    />
  )
}