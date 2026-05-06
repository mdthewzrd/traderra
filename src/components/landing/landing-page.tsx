'use client'

import { SignInButton, SignUpButton, useAuth } from '@clerk/nextjs'
import { Brain, TrendingUp, Shield, Zap } from 'lucide-react'

export function LandingPage() {
  const { isSignedIn } = useAuth()

  return (
    <div className="studio-bg min-h-screen">
      {/* Header */}
      <header className="studio-border border-b px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center space-x-2">
            <Brain className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold studio-text">Traderra</span>
          </div>
          <div className="flex items-center space-x-4">
            {isSignedIn ? (
              <button
                className="btn-primary"
                onClick={() => window.location.href = '/dashboard'}
              >
                Go to Dashboard
              </button>
            ) : (
              <>
                <SignInButton mode="modal">
                  <button className="btn-ghost">
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="btn-primary">
                    Get Started
                  </button>
                </SignUpButton>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight studio-text sm:text-6xl">
            Professional Trading Journal
            <span className="block text-primary">Powered by AI</span>
          </h1>
          <p className="mt-6 text-lg leading-8 studio-muted max-w-2xl mx-auto">
            Meet <strong className="text-primary">Renata</strong>, your AI trading performance counterpart.
            Get objective analysis, professional insights, and systematic improvement guidance.
          </p>
          <div className="mt-10 flex items-center justify-center gap-6">
            {isSignedIn ? (
              <button
                className="btn-primary px-8 py-3 text-lg"
                onClick={() => window.location.href = '/dashboard'}
              >
                Go to Dashboard
              </button>
            ) : (
              <>
                <SignUpButton mode="modal">
                  <button className="btn-primary px-8 py-3 text-lg">
                    Start Your Analysis
                  </button>
                </SignUpButton>
                <button className="btn-ghost px-8 py-3 text-lg">
                  Learn More
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="studio-surface rounded-lg p-8 text-center">
              <Brain className="mx-auto h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold studio-text mb-2">AI-Powered Analysis</h3>
              <p className="studio-muted">
                Renata provides three analysis modes: Analyst (direct), Coach (constructive),
                and Mentor (reflective) - adapting to your preferences.
              </p>
            </div>

            <div className="studio-surface rounded-lg p-8 text-center">
              <TrendingUp className="mx-auto h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold studio-text mb-2">Professional Metrics</h3>
              <p className="studio-muted">
                Advanced performance analytics including expectancy, profit factor,
                drawdown analysis, and R-multiple tracking.
              </p>
            </div>

            <div className="studio-surface rounded-lg p-8 text-center">
              <Shield className="mx-auto h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold studio-text mb-2">Truth-Focused</h3>
              <p className="studio-muted">
                No gamification or emotional manipulation. Pure, objective analysis
                designed for serious traders seeking genuine improvement.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* AI Modes Preview */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center studio-text mb-12">
            Three AI Personalities, One Goal: <span className="text-primary">Your Success</span>
          </h2>

          <div className="space-y-6">
            <div className="ai-message analyst">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="text-sm studio-muted mb-1">Analyst Mode</p>
                  <p className="studio-text">
                    "Expectancy fell 0.2R. Entry timing variance increased. Risk exceeded threshold in 3 trades."
                  </p>
                </div>
              </div>
            </div>

            <div className="ai-message coach">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="text-sm studio-muted mb-1">Coach Mode</p>
                  <p className="studio-text">
                    "You performed better managing losses this week. Focus on execution timing to stabilize expectancy."
                  </p>
                </div>
              </div>
            </div>

            <div className="ai-message mentor">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="text-sm studio-muted mb-1">Mentor Mode</p>
                  <p className="studio-text">
                    "You showed steadiness under pressure. The expectancy deviation stemmed from subtle confidence shifts. Let's examine where conviction wavered."
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold studio-text mb-4">
            Ready to Transform Your Trading Analysis?
          </h2>
          <p className="studio-muted mb-8">
            Join professional traders who trust Traderra for objective, AI-powered performance insights.
          </p>
          {isSignedIn ? (
            <button
              className="btn-primary px-8 py-3 text-lg"
              onClick={() => window.location.href = '/dashboard'}
            >
              Go to Dashboard
            </button>
          ) : (
            <SignUpButton mode="modal">
              <button className="btn-primary px-8 py-3 text-lg">
                Start Free Analysis
              </button>
            </SignUpButton>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="studio-border border-t px-6 py-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Brain className="h-6 w-6 text-primary" />
              <span className="font-semibold studio-text">Traderra</span>
            </div>
            <p className="studio-muted text-sm">
              © 2024 Traderra. Professional trading analysis platform.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}