'use client'

import { SignIn } from '@clerk/nextjs'

export function AuthSignIn() {
  return (
    <SignIn
      appearance={{
        variables: {
          colorPrimary: 'hsl(45, 93%, 35%)', // Traderra gold/amber
          colorBackground: 'hsl(0, 0%, 4%)', // Dark background
          colorInputBackground: 'hsl(0, 0%, 6.7%)', // Card background
          colorInputText: 'hsl(0, 0%, 90%)', // Foreground text
          colorText: 'hsl(0, 0%, 90%)', // Foreground text
          colorTextSecondary: 'hsl(0, 0%, 64.9%)', // Muted text
          colorPrimaryText: 'hsl(0, 0%, 98%)', // Primary foreground
          colorBackground: 'hsl(0, 0%, 4%)', // Background
        },
        elements: {
          formButtonPrimary: 'bg-primary hover:bg-primary/90 text-primary-foreground',
          card: 'bg-card border-border',
          headerTitle: 'text-foreground',
          headerSubtitle: 'text-muted-foreground',
          socialButtonsBlockButton: 'bg-card border-border hover:bg-secondary',
          socialButtonsBlockButtonText: 'text-foreground',
          formFieldLabel: 'text-foreground',
          formFieldInput: 'bg-input border-input text-foreground placeholder:text-muted-foreground',
          footerActionLink: 'text-primary hover:text-primary/90',
          dividerRow: 'border-border',
          dividerText: 'text-muted-foreground',
          alertBox: 'border-destructive/20 bg-destructive/10',
          alertText: 'text-destructive',
        }
      }}
    />
  )
}