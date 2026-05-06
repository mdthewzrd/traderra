'use client'

import { Brain, TrendingUp, Shield, Zap } from 'lucide-react'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="studio-surface border-t border-[#1a1a1a] mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand Section */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 studio-surface rounded-lg shadow-studio-subtle">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold studio-text">Traderra</h3>
                <p className="text-xs studio-muted">AI-Powered Trading Intelligence</p>
              </div>
            </div>
            <p className="studio-muted text-sm leading-relaxed mb-4">
              Professional trading journal and performance analysis platform powered by Renata AI.
              Transform your trading data into actionable insights with advanced analytics and AI-driven coaching.
            </p>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-xs studio-muted">
                <Brain className="h-4 w-4 text-primary" />
                <span>Powered by Renata AI</span>
              </div>
              <div className="flex items-center space-x-2 text-xs studio-muted">
                <Shield className="h-4 w-4 text-green-400" />
                <span>Enterprise Security</span>
              </div>
            </div>
          </div>

          {/* Features */}
          <div>
            <h4 className="text-sm font-semibold studio-text mb-4">Platform</h4>
            <ul className="space-y-3">
              <li>
                <a href="/dashboard" className="text-sm studio-muted hover:studio-text transition-colors flex items-center space-x-2">
                  <TrendingUp className="h-3 w-3" />
                  <span>Performance Dashboard</span>
                </a>
              </li>
              <li>
                <a href="/journal" className="text-sm studio-muted hover:studio-text transition-colors flex items-center space-x-2">
                  <Brain className="h-3 w-3" />
                  <span>AI Journal Analysis</span>
                </a>
              </li>
              <li>
                <a href="/analytics" className="text-sm studio-muted hover:studio-text transition-colors flex items-center space-x-2">
                  <Zap className="h-3 w-3" />
                  <span>Advanced Analytics</span>
                </a>
              </li>
              <li>
                <a href="/settings" className="text-sm studio-muted hover:studio-text transition-colors flex items-center space-x-2">
                  <Shield className="h-3 w-3" />
                  <span>Security Settings</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-sm font-semibold studio-text mb-4">Resources</h4>
            <ul className="space-y-3">
              <li>
                <a href="#" className="text-sm studio-muted hover:studio-text transition-colors">
                  Documentation
                </a>
              </li>
              <li>
                <a href="#" className="text-sm studio-muted hover:studio-text transition-colors">
                  API Reference
                </a>
              </li>
              <li>
                <a href="#" className="text-sm studio-muted hover:studio-text transition-colors">
                  Trading Guides
                </a>
              </li>
              <li>
                <a href="#" className="text-sm studio-muted hover:studio-text transition-colors">
                  Support Center
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between pt-8 mt-8 border-t border-[#1a1a1a]">
          <div className="flex items-center space-x-6 mb-4 md:mb-0">
            <p className="text-xs studio-muted">
              © {currentYear} Traderra. Professional trading analytics platform.
            </p>
          </div>

          <div className="flex items-center space-x-6">
            <a href="#" className="text-xs studio-muted hover:studio-text transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="text-xs studio-muted hover:studio-text transition-colors">
              Terms of Service
            </a>
            <a href="#" className="text-xs studio-muted hover:studio-text transition-colors">
              Security
            </a>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center justify-center space-x-8 pt-6">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse-soft"></div>
            <span className="text-xs studio-muted">System Operational</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
            <span className="text-xs studio-muted">Renata AI Online</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
            <span className="text-xs studio-muted">Real-time Data</span>
          </div>
        </div>
      </div>
    </footer>
  )
}