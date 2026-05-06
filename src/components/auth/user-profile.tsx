'use client'

import { UserButton, useUser, SignInButton } from '@clerk/nextjs'
import { User, Settings, TrendingUp, Calendar } from 'lucide-react'

export function UserProfile() {
  const { user, isLoaded } = useUser()

  if (!isLoaded) {
    return (
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-full bg-muted animate-pulse"></div>
        <div className="flex flex-col space-y-1">
          <div className="h-3 w-20 bg-muted rounded animate-pulse"></div>
          <div className="h-2 w-16 bg-muted rounded animate-pulse"></div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <SignInButton mode="modal">
        <button className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <User className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium studio-text truncate max-w-32">
              Sign In
            </span>
            <span className="text-xs studio-muted">
              Click to sign in
            </span>
          </div>
        </button>
      </SignInButton>
    )
  }

  return (
    <div className="flex items-center space-x-3">
      <UserButton
        appearance={{
          elements: {
            avatarBox: "w-8 h-8",
          }
        }}
      />
      <div className="flex flex-col">
        <span className="text-sm font-medium studio-text truncate max-w-32">
          {user.firstName || user.emailAddresses[0].emailAddress}
        </span>
        <span className="text-xs studio-muted">
          {user.emailAddresses[0].emailAddress}
        </span>
      </div>
    </div>
  )
}

export function UserProfileCard() {
  const { user, isLoaded } = useUser()

  if (!isLoaded) {
    return (
      <div className="studio-surface rounded-lg p-6">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-muted animate-pulse"></div>
          <div className="space-y-2">
            <div className="h-4 w-32 bg-muted rounded animate-pulse"></div>
            <div className="h-3 w-40 bg-muted rounded animate-pulse"></div>
            <div className="h-3 w-28 bg-muted rounded animate-pulse"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="text-center p-3 bg-[#0a0a0a] rounded-lg">
              <div className="w-5 h-5 bg-muted rounded mx-auto mb-1 animate-pulse"></div>
              <div className="h-3 w-20 bg-muted rounded mx-auto mb-1 animate-pulse"></div>
              <div className="h-2 w-16 bg-muted rounded mx-auto animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="studio-surface rounded-lg p-6">
        <div className="flex items-center space-x-4 mb-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
              <User className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold studio-text">Sign In Required</h3>
            <p className="studio-muted text-sm">Please sign in to access your profile</p>
            <p className="studio-muted text-xs flex items-center mt-1">
              <Calendar className="w-3 h-3 mr-1" />
              Authentication required
            </p>
          </div>
          <SignInButton mode="modal">
            <button className="btn-primary">
              Sign In
            </button>
          </SignInButton>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center p-3 bg-[#0a0a0a] rounded-lg">
            <TrendingUp className="w-5 h-5 text-muted mx-auto mb-1" />
            <div className="text-sm font-medium studio-text">Trading Status</div>
            <div className="text-xs studio-muted">Sign in required</div>
          </div>
          <div className="text-center p-3 bg-[#0a0a0a] rounded-lg">
            <User className="w-5 h-5 text-muted mx-auto mb-1" />
            <div className="text-sm font-medium studio-text">Account Type</div>
            <div className="text-xs studio-muted">Sign in required</div>
          </div>
          <div className="text-center p-3 bg-[#0a0a0a] rounded-lg">
            <Settings className="w-5 h-5 text-muted mx-auto mb-1" />
            <div className="text-sm font-medium studio-text">Authentication</div>
            <div className="text-xs studio-muted">Sign in required</div>
          </div>
        </div>
      </div>
    )
  }

  const joinedDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'

  return (
    <div className="studio-surface rounded-lg p-6">
      <div className="flex items-center space-x-4 mb-6">
        <div className="relative">
          <img
            src={user.imageUrl}
            alt={user.firstName || 'User'}
            className="w-16 h-16 rounded-full"
          />
        </div>
        <div>
          <h3 className="text-lg font-semibold studio-text">
            {user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'User'}
          </h3>
          <p className="studio-muted text-sm">{user.emailAddresses[0].emailAddress}</p>
          <p className="studio-muted text-xs flex items-center mt-1">
            <Calendar className="w-3 h-3 mr-1" />
            Joined {joinedDate}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="text-center p-3 bg-[#0a0a0a] rounded-lg">
          <TrendingUp className="w-5 h-5 text-primary mx-auto mb-1" />
          <div className="text-sm font-medium studio-text">Trading Status</div>
          <div className="text-xs studio-muted">Active</div>
        </div>
        <div className="text-center p-3 bg-[#0a0a0a] rounded-lg">
          <User className="w-5 h-5 text-primary mx-auto mb-1" />
          <div className="text-sm font-medium studio-text">Account Type</div>
          <div className="text-xs studio-muted">Professional</div>
        </div>
        <div className="text-center p-3 bg-[#0a0a0a] rounded-lg">
          <Settings className="w-5 h-5 text-primary mx-auto mb-1" />
          <div className="text-sm font-medium studio-text">Authentication</div>
          <div className="text-xs studio-muted">Verified</div>
        </div>
      </div>
    </div>
  )
}