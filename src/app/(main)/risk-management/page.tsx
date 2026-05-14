'use client'

import React, { useState, useEffect } from 'react'
import {
  Shield,
  AlertTriangle,
  TrendingUp,
  Activity,
  BarChart3,
  PieChart,
  Target,
  Eye,
  Bell,
  Settings,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  Info,
  AlertCircle,
  DollarSign,
  Percent,
  Zap,
  Lock,
  Unlock,
  Filter,
  Search,
  ChevronUp,
  ChevronDown,
  MoreVertical,
  ExternalLink
} from 'lucide-react'

interface RiskMetrics {
  portfolioValue: number
  totalExposure: number
  maxDrawdown: number
  currentDrawdown: number
  var95: number
  var99: number
  sharpeRatio: number
  sortinoRatio: number
  beta: number
  correlation: Record<string, number>
  concentration: Record<string, number>
  leverage: number
  liquidityRatio: number
}

interface RiskAlert {
  id: string
  type: 'warning' | 'critical' | 'info'
  category: 'exposure' | 'correlation' | 'liquidity' | 'leverage' | 'drawdown'
  title: string
  message: string
  value: number
  threshold: number
  timestamp: string
  acknowledged: boolean
}

interface Position {
  symbol: string
  quantity: number
  entryPrice: number
  currentPrice: number
  marketValue: number
  unrealizedPnL: number
  weight: number
  beta: number
  sector: string
}

const RiskManagementPage = () => {
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null)
  const [alerts, setAlerts] = useState<RiskAlert[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [activeTab, setActiveTab] = useState<'dashboard' | 'positions' | 'alerts' | 'analysis'>('dashboard')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['metrics', 'alerts']))
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchRiskData()
    const interval = setInterval(fetchRiskData, 30000) // Update every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchRiskData = async () => {
    try {
      const response = await fetch('/api/risk-management?endpoint=dashboard')
      const data = await response.json()
      setRiskMetrics(data.metrics)
      setAlerts(data.alerts)
      setPositions(data.portfolio)
    } catch (error) {
      console.error('Error fetching risk data:', error)
    }
  }

  const acknowledgeAlert = async (alertId: string) => {
    try {
      await fetch('/api/risk-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'acknowledge_alert',
          data: { alertId }
        })
      })

      setAcknowledgedAlerts(prev => new Set([...prev, alertId]))
      setAlerts(prev => prev.map(alert =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      ))
    } catch (error) {
      console.error('Error acknowledging alert:', error)
    }
  }

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  const getRiskLevel = (value: number, thresholds: { low: number; medium: number; high: number }) => {
    if (value <= thresholds.low) return { level: 'low', color: 'green', icon: CheckCircle }
    if (value <= thresholds.medium) return { level: 'medium', color: 'yellow', icon: AlertCircle }
    return { level: 'high', color: 'red', icon: AlertTriangle }
  }

  const getAlertIcon = (type: RiskAlert['type']) => {
    switch (type) {
      case 'critical':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      default:
        return <Info className="w-5 h-5 text-blue-500" />
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
  }

  const renderRiskDashboard = () => (
    <div className="space-y-6">
      {/* Key Risk Metrics */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
          onClick={() => toggleSection('metrics')}
        >
          <div className="flex items-center space-x-3">
            <Shield className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Risk Metrics</h3>
            <span className="text-sm text-gray-500">Real-time portfolio risk assessment</span>
          </div>
          {expandedSections.has('metrics') ?
            <ChevronUp className="w-5 h-5 text-gray-400" /> :
            <ChevronDown className="w-5 h-5 text-gray-400" />
          }
        </div>

        {expandedSections.has('metrics') && riskMetrics && (
          <div className="border-t border-gray-200 p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Portfolio Value</span>
                  <DollarSign className="w-4 h-4 text-gray-400" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(riskMetrics.portfolioValue)}
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Current Drawdown</span>
                  <TrendingUp className="w-4 h-4 text-gray-400" />
                </div>
                <div className={`text-2xl font-bold ${
                  riskMetrics.currentDrawdown > 10 ? 'text-red-600' :
                  riskMetrics.currentDrawdown > 5 ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {formatPercentage(riskMetrics.currentDrawdown)}
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Sharpe Ratio</span>
                  <BarChart3 className="w-4 h-4 text-gray-400" />
                </div>
                <div className={`text-2xl font-bold ${
                  riskMetrics.sharpeRatio > 1.5 ? 'text-green-600' :
                  riskMetrics.sharpeRatio > 1.0 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {riskMetrics.sharpeRatio.toFixed(2)}
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Leverage</span>
                  <Zap className="w-4 h-4 text-gray-400" />
                </div>
                <div className={`text-2xl font-bold ${
                  riskMetrics.leverage > 1.5 ? 'text-red-600' :
                  riskMetrics.leverage > 1.2 ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {riskMetrics.leverage.toFixed(2)}x
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-medium text-red-900">VaR 95%</span>
                </div>
                <div className="text-lg font-semibold text-red-900">
                  {formatCurrency(riskMetrics.var95)}
                </div>
                <p className="text-xs text-red-700">Daily maximum expected loss</p>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-orange-600" />
                  <span className="text-sm font-medium text-orange-900">VaR 99%</span>
                </div>
                <div className="text-lg font-semibold text-orange-900">
                  {formatCurrency(riskMetrics.var99)}
                </div>
                <p className="text-xs text-orange-700">Extreme daily loss scenario</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-2">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Beta</span>
                </div>
                <div className="text-lg font-semibold text-blue-900">
                  {riskMetrics.beta.toFixed(2)}
                </div>
                <p className="text-xs text-blue-700">Market sensitivity</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Risk Alerts */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
          onClick={() => toggleSection('alerts')}
        >
          <div className="flex items-center space-x-3">
            <Bell className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Risk Alerts</h3>
            {alerts.filter(a => !a.acknowledged).length > 0 && (
              <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                {alerts.filter(a => !a.acknowledged).length}
              </span>
            )}
          </div>
          {expandedSections.has('alerts') ?
            <ChevronUp className="w-5 h-5 text-gray-400" /> :
            <ChevronDown className="w-5 h-5 text-gray-400" />
          }
        </div>

        {expandedSections.has('alerts') && (
          <div className="border-t border-gray-200">
            {alerts.filter(alert => !alert.acknowledged).length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-gray-600">No active risk alerts</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {alerts.filter(alert => !alert.acknowledged).map((alert) => (
                  <div key={alert.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start space-x-3">
                      {getAlertIcon(alert.type)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-gray-900">{alert.title}</h4>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              acknowledgeAlert(alert.id)
                            }}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Acknowledge
                          </button>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                          <span>{alert.category}</span>
                          <span>{new Date(alert.timestamp).toLocaleString()}</span>
                          <span className="font-medium">
                            Value: {alert.value}% (Threshold: {alert.threshold}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Concentration Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Sector Concentration</h3>
          {riskMetrics && (
            <div className="space-y-3">
              {Object.entries(riskMetrics.concentration).map(([sector, weight]) => {
                const percentage = weight * 100
                const riskLevel = getRiskLevel(percentage, { low: 20, medium: 30, high: 40 })
                const Icon = riskLevel.icon

                return (
                  <div key={sector} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Icon className={`w-4 h-4 text-${riskLevel.color}-500`} />
                      <span className="text-sm font-medium text-gray-700">{sector}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className={`bg-${riskLevel.color}-500 h-2 rounded-full`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900 min-w-[3rem] text-right">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Position Analysis</h3>
          <div className="space-y-3">
            {positions.slice(0, 5).map((position) => (
              <div key={position.symbol} className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">{position.symbol}</div>
                  <div className="text-xs text-gray-500">{position.sector}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-gray-900">
                    {formatCurrency(position.marketValue)}
                  </div>
                  <div className={`text-xs ${position.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercentage((position.unrealizedPnL / (position.quantity * position.entryPrice)) * 100)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  const renderPositionsAnalysis = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Position Risk Analysis</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Symbol
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Position Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Weight
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    P&L
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Beta
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Risk Level
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {positions.map((position) => {
                  const riskLevel = getRiskLevel(position.weight * 100, { low: 5, medium: 10, high: 15 })
                  const Icon = riskLevel.icon

                  return (
                    <tr key={position.symbol} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{position.symbol}</div>
                          <div className="text-xs text-gray-500">{position.sector}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{position.quantity} shares</div>
                        <div className="text-xs text-gray-500">@ {formatCurrency(position.entryPrice)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className={`bg-${riskLevel.color}-500 h-2 rounded-full`}
                              style={{ width: `${position.weight * 100}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-900">{(position.weight * 100).toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-medium ${position.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(position.unrealizedPnL)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {position.beta.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-1">
                          <Icon className={`w-4 h-4 text-${riskLevel.color}-500`} />
                          <span className={`text-sm font-medium text-${riskLevel.color}-700 capitalize`}>
                            {riskLevel.level}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )

  const renderAlertsCenter = () => {
    const unacknowledgedAlerts = alerts.filter(alert => !alert.acknowledged)
    const acknowledgedAlerts = alerts.filter(alert => alert.acknowledged)

    return (
      <div className="space-y-6">
        {unacknowledgedAlerts.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Active Alerts ({unacknowledgedAlerts.length})</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {unacknowledgedAlerts.map((alert) => (
                <div key={alert.id} className="p-4">
                  <div className="flex items-start space-x-3">
                    {getAlertIcon(alert.type)}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">{alert.title}</h4>
                        <button
                          onClick={() => acknowledgeAlert(alert.id)}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                        >
                          Acknowledge
                        </button>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                      <div className="flex items-center space-x-4 mt-3 text-xs text-gray-500">
                        <span className="bg-gray-100 px-2 py-1 rounded">{alert.category}</span>
                        <span>{new Date(alert.timestamp).toLocaleString()}</span>
                        <span className="font-medium">
                          Current: {alert.value.toFixed(1)}% | Threshold: {alert.threshold.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {acknowledgedAlerts.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Acknowledged Alerts</h3>
            </div>
            <div className="divide-y divide-gray-200 opacity-75">
              {acknowledgedAlerts.map((alert) => (
                <div key={alert.id} className="p-4">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-gray-900">{alert.title}</h4>
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Acknowledged</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                      <div className="flex items-center space-x-4 mt-3 text-xs text-gray-500">
                        <span>{new Date(alert.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Shield className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Risk Management</h1>
                <p className="text-sm text-gray-600">Portfolio risk analysis and monitoring</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
              <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <Download className="w-4 h-4" />
                <span>Export Report</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Activity },
              { id: 'positions', label: 'Positions', icon: Target },
              { id: 'alerts', label: 'Alerts', icon: Bell },
              { id: 'analysis', label: 'Analysis', icon: BarChart3 }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-4 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.id === 'alerts' && alerts.filter(a => !a.acknowledged).length > 0 && (
                  <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                    {alerts.filter(a => !a.acknowledged).length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && renderRiskDashboard()}
        {activeTab === 'positions' && renderPositionsAnalysis()}
        {activeTab === 'alerts' && renderAlertsCenter()}
        {activeTab === 'analysis' && (
          <div className="text-center py-12">
            <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Advanced Analysis</h3>
            <p className="text-gray-600">Correlation analysis and stress testing coming soon</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default RiskManagementPage