'use client'

import React, { useState, useEffect, createContext, useContext } from 'react'
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  toasts: Toast[]
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

interface ToastProviderProps {
  children: React.ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast = {
      ...toast,
      id,
      duration: toast.duration ?? 5000
    }

    setToasts(prev => [...prev, newToast])

    // Auto remove toast after duration
    if (newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, newToast.duration)
    }
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  return (
    <ToastContext.Provider value={{ addToast, removeToast, toasts }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

interface ToastContainerProps {
  toasts: Toast[]
  onRemove: (id: string) => void
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-3 max-w-sm w-full">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}

interface ToastItemProps {
  toast: Toast
  onRemove: (id: string) => void
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  // Animate in
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50)
    return () => clearTimeout(timer)
  }, [])

  const handleRemove = () => {
    setIsLeaving(true)
    setTimeout(() => {
      onRemove(toast.id)
    }, 200)
  }

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'error':
        return <XCircle className="w-5 h-5 text-red-400" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />
      case 'info':
        return <Info className="w-5 h-5 text-blue-400" />
    }
  }

  const getStyles = () => {
    switch (toast.type) {
      case 'success':
        return 'border-green-500/20 bg-green-500/10'
      case 'error':
        return 'border-red-500/20 bg-red-500/10'
      case 'warning':
        return 'border-yellow-500/20 bg-yellow-500/10'
      case 'info':
        return 'border-blue-500/20 bg-blue-500/10'
    }
  }

  return (
    <div
      className={cn(
        'relative flex items-start space-x-3 p-4 rounded-lg border shadow-lg backdrop-blur-sm transition-all duration-200',
        'bg-[#111]/95 border-[#333]',
        getStyles(),
        isVisible && !isLeaving
          ? 'translate-x-0 opacity-100'
          : 'translate-x-full opacity-0',
        isLeaving && '-translate-x-full opacity-0'
      )}
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        {getIcon()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium studio-text">{toast.title}</h4>
        {toast.message && (
          <p className="text-sm text-gray-400 mt-1">{toast.message}</p>
        )}
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className="text-sm text-primary hover:text-primary/80 font-medium mt-2 transition-colors"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={handleRemove}
        className="flex-shrink-0 p-1 hover:bg-white/10 rounded transition-colors"
      >
        <X className="w-4 h-4 text-gray-400" />
      </button>
    </div>
  )
}

// Convenience hooks for specific toast types
export function useSuccessToast() {
  const { addToast } = useToast()
  return (title: string, message?: string) => addToast({ type: 'success', title, message })
}

export function useErrorToast() {
  const { addToast } = useToast()
  return (title: string, message?: string) => addToast({ type: 'error', title, message })
}

export function useWarningToast() {
  const { addToast } = useToast()
  return (title: string, message?: string) => addToast({ type: 'warning', title, message })
}

export function useInfoToast() {
  const { addToast } = useToast()
  return (title: string, message?: string) => addToast({ type: 'info', title, message })
}