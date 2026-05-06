'use client'

import React from 'react'
import { Loader2, AlertTriangle, RefreshCw, Folder, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

// Generic loading spinner
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  }

  return (
    <Loader2 className={cn('animate-spin text-primary', sizeClasses[size], className)} />
  )
}

// Loading states for different scenarios
interface LoadingStateProps {
  type?: 'folders' | 'documents' | 'content' | 'generic'
  message?: string
  className?: string
}

export function LoadingState({ type = 'generic', message, className }: LoadingStateProps) {
  const getContent = () => {
    switch (type) {
      case 'folders':
        return {
          icon: <Folder className="w-8 h-8 text-gray-400 mb-3" />,
          title: 'Loading folders...',
          description: 'Please wait while we load your folder structure.'
        }
      case 'documents':
        return {
          icon: <FileText className="w-8 h-8 text-gray-400 mb-3" />,
          title: 'Loading documents...',
          description: 'Fetching your documents and content.'
        }
      case 'content':
        return {
          icon: <LoadingSpinner size="lg" />,
          title: 'Loading content...',
          description: 'Please wait while we load the content.'
        }
      default:
        return {
          icon: <LoadingSpinner size="lg" />,
          title: 'Loading...',
          description: message || 'Please wait while we process your request.'
        }
    }
  }

  const content = getContent()

  return (
    <div className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
      {content.icon}
      <h3 className="text-lg font-medium studio-text mb-2">{content.title}</h3>
      <p className="text-sm text-gray-400 max-w-md">{content.description}</p>
    </div>
  )
}

// Skeleton loading components
interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-gray-300/10 rounded',
        className
      )}
    />
  )
}

// Folder tree skeleton
export function FolderTreeSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center space-x-3 p-2">
          <Skeleton className="w-4 h-4" />
          <Skeleton className="w-4 h-4" />
          <Skeleton className="h-4 flex-1 max-w-[120px]" />
        </div>
      ))}
    </div>
  )
}

// Document list skeleton
export function DocumentListSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-start space-x-3 p-3">
          <Skeleton className="w-5 h-5 mt-0.5" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Error states
interface ErrorStateProps {
  type?: 'network' | 'permission' | 'notFound' | 'generic'
  title?: string
  message?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  type = 'generic',
  title,
  message,
  onRetry,
  className
}: ErrorStateProps) {
  const getContent = () => {
    switch (type) {
      case 'network':
        return {
          icon: <AlertTriangle className="w-8 h-8 text-red-400 mb-3" />,
          title: title || 'Connection Error',
          message: message || 'Unable to connect to the server. Please check your internet connection.',
          showRetry: true
        }
      case 'permission':
        return {
          icon: <AlertTriangle className="w-8 h-8 text-yellow-400 mb-3" />,
          title: title || 'Access Denied',
          message: message || 'You don\'t have permission to access this resource.',
          showRetry: false
        }
      case 'notFound':
        return {
          icon: <AlertTriangle className="w-8 h-8 text-gray-400 mb-3" />,
          title: title || 'Not Found',
          message: message || 'The requested resource could not be found.',
          showRetry: false
        }
      default:
        return {
          icon: <AlertTriangle className="w-8 h-8 text-red-400 mb-3" />,
          title: title || 'Something went wrong',
          message: message || 'An unexpected error occurred. Please try again.',
          showRetry: true
        }
    }
  }

  const content = getContent()

  return (
    <div className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
      {content.icon}
      <h3 className="text-lg font-medium studio-text mb-2">{content.title}</h3>
      <p className="text-sm text-gray-400 max-w-md mb-4">{content.message}</p>
      {content.showRetry && onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Try Again</span>
        </button>
      )}
    </div>
  )
}

// Empty states
interface EmptyStateProps {
  type?: 'folders' | 'documents' | 'search' | 'generic'
  title?: string
  message?: string
  action?: {
    label: string
    onClick: () => void
    icon?: React.ReactNode
  }
  className?: string
}

export function EmptyState({
  type = 'generic',
  title,
  message,
  action,
  className
}: EmptyStateProps) {
  const getContent = () => {
    switch (type) {
      case 'folders':
        return {
          icon: <Folder className="w-12 h-12 text-gray-400 mb-4" />,
          title: title || 'No folders yet',
          message: message || 'Create your first folder to organize your trading journal.'
        }
      case 'documents':
        return {
          icon: <FileText className="w-12 h-12 text-gray-400 mb-4" />,
          title: title || 'No documents',
          message: message || 'This folder is empty. Start by creating your first document.'
        }
      case 'search':
        return {
          icon: <FileText className="w-12 h-12 text-gray-400 mb-4" />,
          title: title || 'No results found',
          message: message || 'Try adjusting your search criteria or create a new document.'
        }
      default:
        return {
          icon: <FileText className="w-12 h-12 text-gray-400 mb-4" />,
          title: title || 'Nothing here yet',
          message: message || 'Get started by creating some content.'
        }
    }
  }

  const content = getContent()

  return (
    <div className={cn('flex flex-col items-center justify-center p-12 text-center', className)}>
      {content.icon}
      <h3 className="text-xl font-medium studio-text mb-2">{content.title}</h3>
      <p className="text-sm text-gray-400 max-w-md mb-6">{content.message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
        >
          {action.icon}
          <span>{action.label}</span>
        </button>
      )}
    </div>
  )
}

// Loading button state
interface LoadingButtonProps {
  isLoading: boolean
  children: React.ReactNode
  loadingText?: string
  className?: string
  disabled?: boolean
  onClick?: () => void
}

export function LoadingButton({
  isLoading,
  children,
  loadingText,
  className,
  disabled,
  onClick
}: LoadingButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn(
        'inline-flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium',
        'text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
    >
      {isLoading && <LoadingSpinner size="sm" />}
      <span>{isLoading && loadingText ? loadingText : children}</span>
    </button>
  )
}

// Progress indicator for long operations
interface ProgressIndicatorProps {
  progress: number // 0-100
  label?: string
  showPercentage?: boolean
  className?: string
}

export function ProgressIndicator({
  progress,
  label,
  showPercentage = true,
  className
}: ProgressIndicatorProps) {
  const clampedProgress = Math.max(0, Math.min(100, progress))

  return (
    <div className={cn('space-y-2', className)}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center text-sm">
          {label && <span className="studio-text">{label}</span>}
          {showPercentage && (
            <span className="text-gray-400">{Math.round(clampedProgress)}%</span>
          )}
        </div>
      )}
      <div className="w-full bg-[#2a2a2a] rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  )
}

// Inline loading indicator for small spaces
interface InlineLoadingProps {
  text?: string
  className?: string
}

export function InlineLoading({ text = 'Loading...', className }: InlineLoadingProps) {
  return (
    <div className={cn('flex items-center space-x-2 text-sm text-gray-400', className)}>
      <LoadingSpinner size="sm" />
      <span>{text}</span>
    </div>
  )
}