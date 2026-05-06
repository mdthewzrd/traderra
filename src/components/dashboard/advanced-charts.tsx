'use client'

import { useState, useMemo } from 'react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { useDateRange } from '@/contexts/TraderraContext'
import { useDisplayMode } from '@/contexts/TraderraContext'
import { usePnLMode } from '@/contexts/TraderraContext'
import { TraderraTrade } from '@/utils/csv-parser'
import { getPnLValue, getRMultipleValue } from '@/utils/trade-statistics'

// Data validation and utility functions
const validateDataConsistency = <T extends { date: string }>(data: T[], minRequired: number = 5): T[] => {
  const validData = data.filter(item => item.date && new Date(item.date).getTime() > 0)
  return validData.length >= minRequired ? validData : []
}

const normalizeDate = (dateStr: string): string => {
  // Handle various date formats: "4/1", "10/13", "2025-04-01"
  if (dateStr.includes('-')) return dateStr // Already in YYYY-MM-DD format

  // Convert "M/D" to "2025-MM-DD"
  const [month, day] = dateStr.split('/')
  const paddedMonth = month.padStart(2, '0')
  const paddedDay = day.padStart(2, '0')
  return `2025-${paddedMonth}-${paddedDay}`
}

// Enhanced equity curve data spanning 4/1/25 to 10/13/25 with realistic varied P&L
const equityData = [
  { date: '2025-04-01', equity: 10000, dailyPnL: 0, cumPnL: 0, drawdown: 0 },
  { date: '2025-04-02', equity: 10315, dailyPnL: 315, cumPnL: 315, drawdown: 0 },
  { date: '2025-04-03', equity: 10195, dailyPnL: -120, cumPnL: 195, drawdown: -120 },
  { date: '2025-04-04', equity: 10485, dailyPnL: 290, cumPnL: 485, drawdown: 0 },
  { date: '2025-04-07', equity: 10425, dailyPnL: -60, cumPnL: 425, drawdown: -60 },
  { date: '2025-04-08', equity: 10785, dailyPnL: 360, cumPnL: 785, drawdown: 0 },
  { date: '2025-04-09', equity: 10965, dailyPnL: 180, cumPnL: 965, drawdown: 0 },
  { date: '2025-04-10', equity: 10845, dailyPnL: -120, cumPnL: 845, drawdown: -120 },
  { date: '2025-04-11', equity: 11225, dailyPnL: 380, cumPnL: 1225, drawdown: 0 },
  { date: '2025-04-14', equity: 11465, dailyPnL: 240, cumPnL: 1465, drawdown: 0 },
  { date: '2025-04-15', equity: 11285, dailyPnL: -180, cumPnL: 1285, drawdown: -180 },
  { date: '2025-04-16', equity: 11685, dailyPnL: 400, cumPnL: 1685, drawdown: 0 },
  { date: '2025-04-17', equity: 11885, dailyPnL: 200, cumPnL: 1885, drawdown: 0 },
  { date: '2025-04-18', equity: 11745, dailyPnL: -140, cumPnL: 1745, drawdown: -140 },
  { date: '2025-04-21', equity: 12105, dailyPnL: 360, cumPnL: 2105, drawdown: 0 },
  { date: '2025-04-22', equity: 12345, dailyPnL: 240, cumPnL: 2345, drawdown: 0 },
  { date: '2025-04-23', equity: 12185, dailyPnL: -160, cumPnL: 2185, drawdown: -160 },
  { date: '2025-04-24', equity: 12525, dailyPnL: 340, cumPnL: 2525, drawdown: 0 },
  { date: '2025-04-25', equity: 12745, dailyPnL: 220, cumPnL: 2745, drawdown: 0 },
  { date: '2025-04-28', equity: 12545, dailyPnL: -200, cumPnL: 2545, drawdown: -200 },
  { date: '2025-04-29', equity: 12865, dailyPnL: 320, cumPnL: 2865, drawdown: 0 },
  { date: '2025-04-30', equity: 13125, dailyPnL: 260, cumPnL: 3125, drawdown: 0 },
  { date: '2025-05-01', equity: 12985, dailyPnL: -140, cumPnL: 2985, drawdown: -140 },
  { date: '2025-05-02', equity: 13425, dailyPnL: 440, cumPnL: 3425, drawdown: 0 },
  { date: '2025-05-05', equity: 13685, dailyPnL: 260, cumPnL: 3685, drawdown: 0 },
  { date: '2025-05-06', equity: 13485, dailyPnL: -200, cumPnL: 3485, drawdown: -200 },
  { date: '2025-05-07', equity: 13865, dailyPnL: 380, cumPnL: 3865, drawdown: 0 },
  { date: '2025-05-08', equity: 14085, dailyPnL: 220, cumPnL: 4085, drawdown: 0 },
  { date: '2025-05-09', equity: 13945, dailyPnL: -140, cumPnL: 3945, drawdown: -140 },
  { date: '2025-05-12', equity: 14325, dailyPnL: 380, cumPnL: 4325, drawdown: 0 },
  { date: '2025-05-13', equity: 14485, dailyPnL: 160, cumPnL: 4485, drawdown: 0 },
  { date: '2025-05-14', equity: 14305, dailyPnL: -180, cumPnL: 4305, drawdown: -180 },
  { date: '2025-05-15', equity: 14685, dailyPnL: 380, cumPnL: 4685, drawdown: 0 },
  { date: '2025-05-16', equity: 14845, dailyPnL: 160, cumPnL: 4845, drawdown: 0 },
  { date: '2025-05-19', equity: 15145, dailyPnL: 300, cumPnL: 5145, drawdown: 0 },
  { date: '2025-05-20', equity: 14860, dailyPnL: -285, cumPnL: 4860, drawdown: -285 },
  { date: '2025-05-21', equity: 15285, dailyPnL: 425, cumPnL: 5285, drawdown: 0 },
  { date: '2025-05-22', equity: 15465, dailyPnL: 180, cumPnL: 5465, drawdown: 0 },
  { date: '2025-05-23', equity: 15285, dailyPnL: -180, cumPnL: 5285, drawdown: -180 },
  { date: '2025-05-27', equity: 15725, dailyPnL: 440, cumPnL: 5725, drawdown: 0 },
  { date: '2025-05-28', equity: 15945, dailyPnL: 220, cumPnL: 5945, drawdown: 0 },
  { date: '2025-05-29', equity: 15745, dailyPnL: -200, cumPnL: 5745, drawdown: -200 },
  { date: '2025-05-30', equity: 16125, dailyPnL: 380, cumPnL: 6125, drawdown: 0 },
  { date: '2025-06-02', equity: 16285, dailyPnL: 160, cumPnL: 6285, drawdown: 0 },
  { date: '2025-06-03', equity: 16585, dailyPnL: 300, cumPnL: 6585, drawdown: 0 },
  { date: '2025-06-04', equity: 16385, dailyPnL: -200, cumPnL: 6385, drawdown: -200 },
  { date: '2025-06-05', equity: 16765, dailyPnL: 380, cumPnL: 6765, drawdown: 0 },
  { date: '2025-06-06', equity: 16925, dailyPnL: 160, cumPnL: 6925, drawdown: 0 },
  { date: '2025-06-09', equity: 17285, dailyPnL: 360, cumPnL: 7285, drawdown: 0 },
  { date: '2025-06-10', equity: 17445, dailyPnL: 160, cumPnL: 7445, drawdown: 0 },
  { date: '2025-06-11', equity: 17245, dailyPnL: -200, cumPnL: 7245, drawdown: -200 },
  { date: '2025-06-12', equity: 17625, dailyPnL: 380, cumPnL: 7625, drawdown: 0 },
  { date: '2025-06-13', equity: 17785, dailyPnL: 160, cumPnL: 7785, drawdown: 0 },
  { date: '2025-06-16', equity: 17585, dailyPnL: -200, cumPnL: 7585, drawdown: -200 },
  { date: '2025-06-17', equity: 17965, dailyPnL: 380, cumPnL: 7965, drawdown: 0 },
  { date: '2025-06-18', equity: 18125, dailyPnL: 160, cumPnL: 8125, drawdown: 0 },
  { date: '2025-06-19', equity: 17925, dailyPnL: -200, cumPnL: 7925, drawdown: -200 },
  { date: '2025-06-20', equity: 18305, dailyPnL: 380, cumPnL: 8305, drawdown: 0 },
  { date: '2025-06-23', equity: 18465, dailyPnL: 160, cumPnL: 8465, drawdown: 0 },
  { date: '2025-06-24', equity: 18765, dailyPnL: 300, cumPnL: 8765, drawdown: 0 },
  { date: '2025-06-25', equity: 18420, dailyPnL: -345, cumPnL: 8420, drawdown: -345 },
  { date: '2025-06-26', equity: 18825, dailyPnL: 405, cumPnL: 8825, drawdown: 0 },
  { date: '2025-06-27', equity: 18985, dailyPnL: 160, cumPnL: 8985, drawdown: 0 },
  { date: '2025-06-30', equity: 18785, dailyPnL: -200, cumPnL: 8785, drawdown: -200 },
  { date: '2025-07-01', equity: 19165, dailyPnL: 380, cumPnL: 9165, drawdown: 0 },
  { date: '2025-07-02', equity: 19325, dailyPnL: 160, cumPnL: 9325, drawdown: 0 },
  { date: '2025-07-03', equity: 19125, dailyPnL: -200, cumPnL: 9125, drawdown: -200 },
  { date: '2025-07-07', equity: 19505, dailyPnL: 380, cumPnL: 9505, drawdown: 0 },
  { date: '2025-07-08', equity: 19665, dailyPnL: 160, cumPnL: 9665, drawdown: 0 },
  { date: '2025-07-09', equity: 19465, dailyPnL: -200, cumPnL: 9465, drawdown: -200 },
  { date: '2025-07-10', equity: 19845, dailyPnL: 380, cumPnL: 9845, drawdown: 0 },
  { date: '2025-07-11', equity: 20005, dailyPnL: 160, cumPnL: 10005, drawdown: 0 },
  { date: '2025-07-14', equity: 19805, dailyPnL: -200, cumPnL: 9805, drawdown: -200 },
  { date: '2025-07-15', equity: 20185, dailyPnL: 380, cumPnL: 10185, drawdown: 0 },
  { date: '2025-07-16', equity: 20345, dailyPnL: 160, cumPnL: 10345, drawdown: 0 },
  { date: '2025-07-17', equity: 19960, dailyPnL: -385, cumPnL: 9960, drawdown: -385 },
  { date: '2025-07-18', equity: 20365, dailyPnL: 405, cumPnL: 10365, drawdown: 0 },
  { date: '2025-07-21', equity: 20525, dailyPnL: 160, cumPnL: 10525, drawdown: 0 },
  { date: '2025-07-22', equity: 20325, dailyPnL: -200, cumPnL: 10325, drawdown: -200 },
  { date: '2025-07-23', equity: 20705, dailyPnL: 380, cumPnL: 10705, drawdown: 0 },
  { date: '2025-07-24', equity: 20865, dailyPnL: 160, cumPnL: 10865, drawdown: 0 },
  { date: '2025-07-25', equity: 20665, dailyPnL: -200, cumPnL: 10665, drawdown: -200 },
  { date: '2025-07-28', equity: 21045, dailyPnL: 380, cumPnL: 11045, drawdown: 0 },
  { date: '2025-07-29', equity: 21205, dailyPnL: 160, cumPnL: 11205, drawdown: 0 },
  { date: '2025-07-30', equity: 20780, dailyPnL: -425, cumPnL: 10780, drawdown: -425 },
  { date: '2025-07-31', equity: 21205, dailyPnL: 425, cumPnL: 11205, drawdown: 0 },
  { date: '2025-08-01', equity: 21365, dailyPnL: 160, cumPnL: 11365, drawdown: 0 },
  { date: '2025-08-04', equity: 21165, dailyPnL: -200, cumPnL: 11165, drawdown: -200 },
  { date: '2025-08-05', equity: 21545, dailyPnL: 380, cumPnL: 11545, drawdown: 0 },
  { date: '2025-08-06', equity: 21705, dailyPnL: 160, cumPnL: 11705, drawdown: 0 },
  { date: '2025-08-07', equity: 21505, dailyPnL: -200, cumPnL: 11505, drawdown: -200 },
  { date: '2025-08-08', equity: 21885, dailyPnL: 380, cumPnL: 11885, drawdown: 0 },
  { date: '2025-08-11', equity: 22045, dailyPnL: 160, cumPnL: 12045, drawdown: 0 },
  { date: '2025-08-12', equity: 21845, dailyPnL: -200, cumPnL: 11845, drawdown: -200 },
  { date: '2025-08-13', equity: 22225, dailyPnL: 380, cumPnL: 12225, drawdown: 0 },
  { date: '2025-08-14', equity: 22385, dailyPnL: 160, cumPnL: 12385, drawdown: 0 },
  { date: '2025-08-15', equity: 21900, dailyPnL: -485, cumPnL: 11900, drawdown: -485 },
  { date: '2025-08-18', equity: 22325, dailyPnL: 425, cumPnL: 12325, drawdown: 0 },
  { date: '2025-08-19', equity: 22485, dailyPnL: 160, cumPnL: 12485, drawdown: 0 },
  { date: '2025-08-20', equity: 22285, dailyPnL: -200, cumPnL: 12285, drawdown: -200 },
  { date: '2025-08-21', equity: 22665, dailyPnL: 380, cumPnL: 12665, drawdown: 0 },
  { date: '2025-08-22', equity: 22825, dailyPnL: 160, cumPnL: 12825, drawdown: 0 },
  { date: '2025-08-25', equity: 22625, dailyPnL: -200, cumPnL: 12625, drawdown: -200 },
  { date: '2025-08-26', equity: 23470, dailyPnL: 845, cumPnL: 13470, drawdown: 0 },
  { date: '2025-08-27', equity: 23630, dailyPnL: 160, cumPnL: 13630, drawdown: 0 },
  { date: '2025-08-28', equity: 23430, dailyPnL: -200, cumPnL: 13430, drawdown: -200 },
  { date: '2025-08-29', equity: 23810, dailyPnL: 380, cumPnL: 13810, drawdown: 0 },
  { date: '2025-09-02', equity: 23970, dailyPnL: 160, cumPnL: 13970, drawdown: 0 },
  { date: '2025-09-03', equity: 23770, dailyPnL: -200, cumPnL: 13770, drawdown: -200 },
  { date: '2025-09-04', equity: 24150, dailyPnL: 380, cumPnL: 14150, drawdown: 0 },
  { date: '2025-09-05', equity: 24310, dailyPnL: 160, cumPnL: 14310, drawdown: 0 },
  { date: '2025-09-08', equity: 24110, dailyPnL: -200, cumPnL: 14110, drawdown: -200 },
  { date: '2025-09-09', equity: 24490, dailyPnL: 380, cumPnL: 14490, drawdown: 0 },
  { date: '2025-09-10', equity: 24650, dailyPnL: 160, cumPnL: 14650, drawdown: 0 },
  { date: '2025-09-11', equity: 24450, dailyPnL: -200, cumPnL: 14450, drawdown: -200 },
  { date: '2025-09-12', equity: 24830, dailyPnL: 380, cumPnL: 14830, drawdown: 0 },
  { date: '2025-09-15', equity: 24990, dailyPnL: 160, cumPnL: 14990, drawdown: 0 },
  { date: '2025-09-16', equity: 24790, dailyPnL: -200, cumPnL: 14790, drawdown: -200 },
  { date: '2025-09-17', equity: 25775, dailyPnL: 985, cumPnL: 15775, drawdown: 0 },
  { date: '2025-09-18', equity: 25935, dailyPnL: 160, cumPnL: 15935, drawdown: 0 },
  { date: '2025-09-19', equity: 25735, dailyPnL: -200, cumPnL: 15735, drawdown: -200 },
  { date: '2025-09-22', equity: 26115, dailyPnL: 380, cumPnL: 16115, drawdown: 0 },
  { date: '2025-09-23', equity: 26275, dailyPnL: 160, cumPnL: 16275, drawdown: 0 },
  { date: '2025-09-24', equity: 26075, dailyPnL: -200, cumPnL: 16075, drawdown: -200 },
  { date: '2025-09-25', equity: 27200, dailyPnL: 1125, cumPnL: 17200, drawdown: 0 },
  { date: '2025-09-26', equity: 27360, dailyPnL: 160, cumPnL: 17360, drawdown: 0 },
  { date: '2025-09-29', equity: 27160, dailyPnL: -200, cumPnL: 17160, drawdown: -200 },
  { date: '2025-09-30', equity: 27540, dailyPnL: 380, cumPnL: 17540, drawdown: 0 },
  { date: '2025-10-01', equity: 27700, dailyPnL: 160, cumPnL: 17700, drawdown: 0 },
  { date: '2025-10-02', equity: 27500, dailyPnL: -200, cumPnL: 17500, drawdown: -200 },
  { date: '2025-10-03', equity: 28785, dailyPnL: 1285, cumPnL: 18785, drawdown: 0 },
  { date: '2025-10-06', equity: 28945, dailyPnL: 160, cumPnL: 18945, drawdown: 0 },
  { date: '2025-10-07', equity: 28745, dailyPnL: -200, cumPnL: 18745, drawdown: -200 },
  { date: '2025-10-08', equity: 30230, dailyPnL: 1485, cumPnL: 20230, drawdown: 0 },
  { date: '2025-10-09', equity: 30390, dailyPnL: 160, cumPnL: 20390, drawdown: 0 },
  { date: '2025-10-10', equity: 30190, dailyPnL: -200, cumPnL: 20190, drawdown: -200 },
  { date: '2025-10-13', equity: 30570, dailyPnL: 380, cumPnL: 20570, drawdown: 0 },
  { date: '2025-10-14', equity: 32080, dailyPnL: 1510, cumPnL: 22080, drawdown: 0 },
  { date: '2025-10-15', equity: 32490, dailyPnL: 410, cumPnL: 22490, drawdown: 0 },
]

// Daily P&L data spanning 4/1/25 to 10/13/25 with highly varied realistic P&L amounts
const dailyPnLDistribution = [
  { date: '2025-04-01', pnl: 0, trades: 0 },
  { date: '2025-04-02', pnl: 315, trades: 2 },
  { date: '2025-04-03', pnl: -120, trades: 1 },
  { date: '2025-04-04', pnl: 290, trades: 3 },
  { date: '2025-04-07', pnl: -60, trades: 1 },
  { date: '2025-04-08', pnl: 360, trades: 2 },
  { date: '2025-04-09', pnl: 180, trades: 2 },
  { date: '2025-04-10', pnl: -120, trades: 1 },
  { date: '2025-04-11', pnl: 380, trades: 3 },
  { date: '2025-04-14', pnl: 240, trades: 2 },
  { date: '2025-04-15', pnl: -180, trades: 1 },
  { date: '2025-04-16', pnl: 400, trades: 2 },
  { date: '2025-04-17', pnl: 200, trades: 2 },
  { date: '2025-04-18', pnl: -140, trades: 1 },
  { date: '2025-04-21', pnl: 360, trades: 2 },
  { date: '2025-04-22', pnl: 240, trades: 2 },
  { date: '2025-04-23', pnl: -160, trades: 1 },
  { date: '2025-04-24', pnl: 340, trades: 3 },
  { date: '2025-04-25', pnl: 220, trades: 2 },
  { date: '2025-04-28', pnl: -85, trades: 1 },
  { date: '2025-04-29', pnl: 320, trades: 2 },
  { date: '2025-04-30', pnl: 260, trades: 2 },
  { date: '5/1', pnl: -140, trades: 1 },
  { date: '5/2', pnl: 440, trades: 3 },
  { date: '5/5', pnl: 275, trades: 2 },
  { date: '5/6', pnl: -165, trades: 1 },
  { date: '5/7', pnl: 395, trades: 3 },
  { date: '5/8', pnl: 185, trades: 2 },
  { date: '5/9', pnl: -95, trades: 1 },
  { date: '5/12', pnl: 420, trades: 3 },
  { date: '5/13', pnl: 135, trades: 2 },
  { date: '5/14', pnl: -155, trades: 1 },
  { date: '5/15', pnl: 365, trades: 3 },
  { date: '5/16', pnl: 210, trades: 2 },
  { date: '5/19', pnl: 345, trades: 3 },
  { date: '5/20', pnl: -285, trades: 1 },
  { date: '5/21', pnl: 425, trades: 3 },
  { date: '5/22', pnl: 165, trades: 2 },
  { date: '5/23', pnl: -125, trades: 1 },
  { date: '5/27', pnl: 485, trades: 3 },
  { date: '5/28', pnl: 195, trades: 2 },
  { date: '5/29', pnl: -110, trades: 1 },
  { date: '5/30', pnl: 355, trades: 3 },
  { date: '6/2', pnl: 145, trades: 2 },
  { date: '6/3', pnl: 320, trades: 3 },
  { date: '6/4', pnl: -175, trades: 1 },
  { date: '6/5', pnl: 410, trades: 3 },
  { date: '6/6', pnl: 125, trades: 2 },
  { date: '6/9', pnl: 385, trades: 3 },
  { date: '6/10', pnl: 225, trades: 2 },
  { date: '6/11', pnl: -145, trades: 1 },
  { date: '6/12', pnl: 305, trades: 3 },
  { date: '6/13', pnl: 175, trades: 2 },
  { date: '6/16', pnl: -90, trades: 1 },
  { date: '6/17', pnl: 445, trades: 3 },
  { date: '6/18', pnl: 115, trades: 2 },
  { date: '6/19', pnl: -135, trades: 1 },
  { date: '6/20', pnl: 295, trades: 3 },
  { date: '6/23', pnl: 255, trades: 2 },
  { date: '6/24', pnl: 330, trades: 3 },
  { date: '6/25', pnl: -345, trades: 1 },
  { date: '6/26', pnl: 405, trades: 3 },
  { date: '6/27', pnl: 190, trades: 2 },
  { date: '6/30', pnl: -105, trades: 1 },
  { date: '7/1', pnl: 350, trades: 3 },
  { date: '7/2', pnl: 215, trades: 2 },
  { date: '7/3', pnl: -155, trades: 1 },
  { date: '7/7', pnl: 465, trades: 3 },
  { date: '7/8', pnl: 130, trades: 2 },
  { date: '7/9', pnl: -80, trades: 1 },
  { date: '7/10', pnl: 315, trades: 3 },
  { date: '7/11', pnl: 245, trades: 2 },
  { date: '7/14', pnl: -170, trades: 1 },
  { date: '7/15', pnl: 425, trades: 3 },
  { date: '7/16', pnl: 155, trades: 2 },
  { date: '7/17', pnl: -385, trades: 1 },
  { date: '7/18', pnl: 405, trades: 3 },
  { date: '7/21', pnl: 185, trades: 2 },
  { date: '7/22', pnl: -115, trades: 1 },
  { date: '7/23', pnl: 335, trades: 3 },
  { date: '7/24', pnl: 205, trades: 2 },
  { date: '7/25', pnl: -95, trades: 1 },
  { date: '7/28', pnl: 390, trades: 3 },
  { date: '7/29', pnl: 165, trades: 2 },
  { date: '7/30', pnl: -425, trades: 1 },
  { date: '7/31', pnl: 435, trades: 3 },
  { date: '8/1', pnl: 125, trades: 2 },
  { date: '8/4', pnl: -145, trades: 1 },
  { date: '8/5', pnl: 325, trades: 3 },
  { date: '8/6', pnl: 235, trades: 2 },
  { date: '8/7', pnl: -75, trades: 1 },
  { date: '8/8', pnl: 455, trades: 3 },
  { date: '8/11', pnl: 175, trades: 2 },
  { date: '8/12', pnl: -120, trades: 1 },
  { date: '8/13', pnl: 365, trades: 3 },
  { date: '8/14', pnl: 195, trades: 2 },
  { date: '8/15', pnl: -485, trades: 1 },
  { date: '8/18', pnl: 445, trades: 3 },
  { date: '8/19', pnl: 140, trades: 2 },
  { date: '8/20', pnl: -110, trades: 1 },
  { date: '8/21', pnl: 305, trades: 3 },
  { date: '8/22', pnl: 225, trades: 2 },
  { date: '8/25', pnl: -85, trades: 1 },
  { date: '8/26', pnl: 845, trades: 3 },
  { date: '8/27', pnl: 155, trades: 2 },
  { date: '8/28', pnl: -165, trades: 1 },
  { date: '8/29', pnl: 415, trades: 3 },
  { date: '9/2', pnl: 185, trades: 2 },
  { date: '9/3', pnl: -135, trades: 1 },
  { date: '9/4', pnl: 295, trades: 3 },
  { date: '9/5', pnl: 265, trades: 2 },
  { date: '9/8', pnl: -105, trades: 1 },
  { date: '9/9', pnl: 375, trades: 3 },
  { date: '9/10', pnl: 215, trades: 2 },
  { date: '9/11', pnl: -95, trades: 1 },
  { date: '9/12', pnl: 335, trades: 3 },
  { date: '9/15', pnl: 245, trades: 2 },
  { date: '9/16', pnl: -125, trades: 1 },
  { date: '9/17', pnl: 985, trades: 3 },
  { date: '9/18', pnl: 165, trades: 2 },
  { date: '9/19', pnl: -75, trades: 1 },
  { date: '9/22', pnl: 285, trades: 3 },
  { date: '9/23', pnl: 205, trades: 2 },
  { date: '9/24', pnl: -155, trades: 1 },
  { date: '9/25', pnl: 1125, trades: 3 },
  { date: '9/26', pnl: 175, trades: 2 },
  { date: '9/29', pnl: -115, trades: 1 },
  { date: '9/30', pnl: 395, trades: 3 },
  { date: '10/1', pnl: 145, trades: 2 },
  { date: '10/2', pnl: -90, trades: 1 },
  { date: '10/3', pnl: 1285, trades: 3 },
  { date: '10/6', pnl: 185, trades: 2 },
  { date: '10/7', pnl: -135, trades: 1 },
  { date: '10/8', pnl: 1485, trades: 3 },
  { date: '10/9', pnl: 225, trades: 2 },
  { date: '10/10', pnl: -105, trades: 1 },
  { date: '10/13', pnl: 380, trades: 3 },
  { date: '10/14', pnl: 1510, trades: 3 },
  { date: '10/15', pnl: 410, trades: 3 },
]

// Win/Loss distribution
const winLossData = [
  { name: 'Wins', value: 35, color: '#22c55e' },
  { name: 'Losses', value: 32, color: '#ef4444' },
]

// Symbol performance data with date-based trades for filtering
const symbolTradesData = [
  // NVDA trades
  { symbol: 'NVDA', date: '2025-10-14', pnl: 1485, trades: 1 },
  { symbol: 'NVDA', date: '2025-10-08', pnl: 1485, trades: 1 },
  { symbol: 'NVDA', date: '2025-09-22', pnl: 485, trades: 1 },
  { symbol: 'NVDA', date: '2025-08-15', pnl: 425, trades: 1 },
  { symbol: 'NVDA', date: '2025-07-28', pnl: 365, trades: 1 },
  { symbol: 'NVDA', date: '2025-06-12', pnl: 285, trades: 1 },
  { symbol: 'NVDA', date: '2025-05-08', pnl: 200, trades: 1 },
  // AAPL trades
  { symbol: 'AAPL', date: '2025-10-03', pnl: 1285, trades: 1 },
  { symbol: 'AAPL', date: '2025-09-18', pnl: 345, trades: 1 },
  { symbol: 'AAPL', date: '2025-08-22', pnl: 265, trades: 1 },
  { symbol: 'AAPL', date: '2025-07-15', pnl: 485, trades: 1 },
  { symbol: 'AAPL', date: '2025-06-05', pnl: 225, trades: 1 },
  { symbol: 'AAPL', date: '2025-05-15', pnl: 185, trades: 1 },
  { symbol: 'AAPL', date: '2025-04-22', pnl: 165, trades: 1 },
  // Small cap growth stocks
  { symbol: 'PLTR', date: '2025-10-15', pnl: 325, trades: 1 },
  { symbol: 'PLTR', date: '2025-10-13', pnl: 180, trades: 1 },
  { symbol: 'PLTR', date: '2025-09-28', pnl: 240, trades: 1 },
  { symbol: 'SOFI', date: '2025-10-15', pnl: 180, trades: 1 },
  { symbol: 'SOFI', date: '2025-09-15', pnl: 165, trades: 1 },
  { symbol: 'RBLX', date: '2025-10-14', pnl: 425, trades: 1 },
  { symbol: 'RBLX', date: '2025-08-22', pnl: 265, trades: 1 },
  { symbol: 'HOOD', date: '2025-10-11', pnl: 185, trades: 1 },
  { symbol: 'HOOD', date: '2025-09-08', pnl: 140, trades: 1 },
  { symbol: 'LCID', date: '2025-10-11', pnl: 290, trades: 1 },
  { symbol: 'LCID', date: '2025-08-28', pnl: 195, trades: 1 },
  { symbol: 'RIVN', date: '2025-10-08', pnl: 285, trades: 1 },
  { symbol: 'RIVN', date: '2025-07-24', pnl: 220, trades: 1 },
  { symbol: 'COIN', date: '2025-10-01', pnl: 275, trades: 1 },
  { symbol: 'COIN', date: '2025-08-14', pnl: 185, trades: 1 },
  { symbol: 'SQ', date: '2025-10-01', pnl: 160, trades: 1 },
  { symbol: 'SQ', date: '2025-09-11', pnl: 225, trades: 1 },
  { symbol: 'ROKU', date: '2025-09-26', pnl: 160, trades: 1 },
  { symbol: 'ROKU', date: '2025-08-19', pnl: 145, trades: 1 },
  { symbol: 'SHOP', date: '2025-09-26', pnl: 385, trades: 1 },
  { symbol: 'SHOP', date: '2025-09-10', pnl: 295, trades: 1 },
  // MSFT trades
  { symbol: 'MSFT', date: '2025-09-25', pnl: 1125, trades: 1 },
  { symbol: 'MSFT', date: '2025-09-17', pnl: 325, trades: 1 },
  { symbol: 'MSFT', date: '2025-08-18', pnl: 325, trades: 1 },
  { symbol: 'MSFT', date: '2025-07-11', pnl: 285, trades: 1 },
  { symbol: 'MSFT', date: '2025-06-20', pnl: 245, trades: 1 },
  { symbol: 'MSFT', date: '2025-05-22', pnl: 154, trades: 1 },
  // GOOGL trades
  { symbol: 'GOOGL', date: '2025-09-25', pnl: 1125, trades: 1 },
  { symbol: 'GOOGL', date: '2025-09-17', pnl: 985, trades: 1 },
  { symbol: 'GOOGL', date: '2025-08-11', pnl: 365, trades: 1 },
  { symbol: 'GOOGL', date: '2025-07-02', pnl: 285, trades: 1 },
  { symbol: 'GOOGL', date: '2025-06-09', pnl: 190, trades: 1 },
  // TSLA trades
  { symbol: 'TSLA', date: '2025-08-26', pnl: 845, trades: 1 },
  { symbol: 'TSLA', date: '2025-07-24', pnl: 285, trades: 1 },
  { symbol: 'TSLA', date: '2025-06-16', pnl: 185, trades: 1 },
  { symbol: 'TSLA', date: '2025-05-29', pnl: 141, trades: 1 },
  // AMZN trades
  { symbol: 'AMZN', date: '2025-07-15', pnl: 720, trades: 1 },
  { symbol: 'AMZN', date: '2025-06-24', pnl: 225, trades: 1 },
  { symbol: 'AMZN', date: '2025-05-19', pnl: 180, trades: 1 },
  // META trades
  { symbol: 'META', date: '2025-06-12', pnl: 650, trades: 1 },
  { symbol: 'META', date: '2025-05-16', pnl: 185, trades: 1 },
  { symbol: 'META', date: '2025-04-25', pnl: 150, trades: 1 },
  // JPM trades
  { symbol: 'JPM', date: '2025-05-08', pnl: 580, trades: 1 },
  { symbol: 'JPM', date: '2025-04-16', pnl: 65, trades: 1 },
  // Losing trades - Traditional stocks
  { symbol: 'KO', date: '2025-08-15', pnl: -485, trades: 1 },
  { symbol: 'KO', date: '2025-07-09', pnl: -135, trades: 1 },
  { symbol: 'KO', date: '2025-06-04', pnl: -85, trades: 1 },
  { symbol: 'HD', date: '2025-07-30', pnl: -425, trades: 1 },
  { symbol: 'HD', date: '2025-06-11', pnl: -95, trades: 1 },
  { symbol: 'HD', date: '2025-05-14', pnl: -65, trades: 1 },
  { symbol: 'PG', date: '2025-07-17', pnl: -385, trades: 1 },
  { symbol: 'PG', date: '2025-05-23', pnl: -105, trades: 1 },
  { symbol: 'V', date: '2025-06-25', pnl: -345, trades: 1 },
  { symbol: 'V', date: '2025-04-28', pnl: -85, trades: 1 },
  { symbol: 'JNJ', date: '2025-05-20', pnl: -285, trades: 1 },
  { symbol: 'JNJ', date: '2025-04-15', pnl: -75, trades: 1 },
  // Small cap losing trades
  { symbol: 'WISH', date: '2025-10-15', pnl: -95, trades: 1 },
  { symbol: 'WISH', date: '2025-09-12', pnl: -125, trades: 1 },
  { symbol: 'SPCE', date: '2025-10-14', pnl: -180, trades: 1 },
  { symbol: 'SPCE', date: '2025-08-08', pnl: -155, trades: 1 },
  { symbol: 'PLUG', date: '2025-10-13', pnl: -245, trades: 1 },
  { symbol: 'PLUG', date: '2025-07-20', pnl: -165, trades: 1 },
  { symbol: 'NKLA', date: '2025-10-07', pnl: -160, trades: 1 },
  { symbol: 'NKLA', date: '2025-09-05', pnl: -185, trades: 1 },
  { symbol: 'CLOV', date: '2025-10-11', pnl: -125, trades: 1 },
  { symbol: 'CLOV', date: '2025-08-18', pnl: -145, trades: 1 },
  { symbol: 'MULN', date: '2025-10-09', pnl: -135, trades: 1 },
  { symbol: 'MULN', date: '2025-07-15', pnl: -110, trades: 1 },
  { symbol: 'UPST', date: '2025-09-24', pnl: -200, trades: 1 },
  { symbol: 'UPST', date: '2025-06-30', pnl: -175, trades: 1 },
  { symbol: 'PTON', date: '2025-09-22', pnl: -135, trades: 1 },
  { symbol: 'PTON', date: '2025-07-08', pnl: -120, trades: 1 },
  { symbol: 'SNAP', date: '2025-10-02', pnl: -200, trades: 1 },
  { symbol: 'SNAP', date: '2025-08-25', pnl: -150, trades: 1 },
  { symbol: 'PINS', date: '2025-09-29', pnl: -200, trades: 1 },
  { symbol: 'PINS', date: '2025-08-25', pnl: -200, trades: 1 },
  // Additional current week trades for better 7-day filtering
  { symbol: 'TSLA', date: '2025-10-14', pnl: 245, trades: 1 },
  { symbol: 'GOOGL', date: '2025-10-15', pnl: 185, trades: 1 },
  { symbol: 'MSFT', date: '2025-10-13', pnl: 165, trades: 1 },
  { symbol: 'AMZN', date: '2025-10-15', pnl: 220, trades: 1 },
  { symbol: 'META', date: '2025-10-14', pnl: 195, trades: 1 },
]

// Best/Biggest trades data with mix of large cap and small cap tickers (4/1/25 to 10/13/25)
const bestTradesData = [
  { symbol: 'NVDA', date: '2025-10-14', pnl: 1485, rMultiple: 4.8, type: 'Long', entry: 875.20, exit: 942.85 },
  { symbol: 'AAPL', date: '2025-10-03', pnl: 1285, rMultiple: 4.2, type: 'Long', entry: 168.45, exit: 176.80 },
  { symbol: 'MSFT', date: '2025-09-25', pnl: 1125, rMultiple: 3.9, type: 'Long', entry: 425.80, exit: 441.25 },
  { symbol: 'GOOGL', date: '2025-09-17', pnl: 985, rMultiple: 3.5, type: 'Long', entry: 142.20, exit: 149.85 },
  { symbol: 'TSLA', date: '2025-10-08', pnl: 845, rMultiple: 3.1, type: 'Long', entry: 195.40, exit: 208.75 },
  { symbol: 'AMZN', date: '2025-07-15', pnl: 720, rMultiple: 2.8, type: 'Long', entry: 185.30, exit: 198.45 },
  { symbol: 'META', date: '2025-08-26', pnl: 650, rMultiple: 2.5, type: 'Long', entry: 425.60, exit: 445.20 },
  { symbol: 'RBLX', date: '2025-10-14', pnl: 425, rMultiple: 2.1, type: 'Long', entry: 38.20, exit: 42.15 },
  { symbol: 'SHOP', date: '2025-09-26', pnl: 385, rMultiple: 1.9, type: 'Long', entry: 72.40, exit: 78.85 },
  { symbol: 'RIOT', date: '2025-10-13', pnl: 340, rMultiple: 1.8, type: 'Long', entry: 14.20, exit: 17.65 },
  { symbol: 'PLTR', date: '2025-10-15', pnl: 325, rMultiple: 1.7, type: 'Long', entry: 28.40, exit: 31.15 },
  { symbol: 'LCID', date: '2025-10-11', pnl: 290, rMultiple: 1.6, type: 'Long', entry: 3.85, exit: 4.72 },
  { symbol: 'RIVN', date: '2025-10-08', pnl: 285, rMultiple: 1.5, type: 'Long', entry: 12.30, exit: 14.85 },
  { symbol: 'COIN', date: '2025-10-01', pnl: 275, rMultiple: 1.4, type: 'Long', entry: 158.20, exit: 172.45 },
  // Additional current week trades for better 7-day filtering
  { symbol: 'TSLA', date: '2025-10-14', pnl: 245, rMultiple: 1.3, type: 'Long', entry: 242.10, exit: 248.85 },
  { symbol: 'AMZN', date: '2025-10-15', pnl: 220, rMultiple: 1.2, type: 'Long', entry: 178.20, exit: 183.45 },
  { symbol: 'META', date: '2025-10-14', pnl: 195, rMultiple: 1.1, type: 'Long', entry: 485.30, exit: 492.15 },
  { symbol: 'GOOGL', date: '2025-10-15', pnl: 185, rMultiple: 1.0, type: 'Long', entry: 145.60, exit: 148.95 },
  { symbol: 'MSFT', date: '2025-10-13', pnl: 165, rMultiple: 0.9, type: 'Long', entry: 428.40, exit: 432.20 },
]

const worstTradesData = [
  { symbol: 'KO', date: '2025-08-15', pnl: -485, rMultiple: -2.8, type: 'Long', entry: 62.85, exit: 60.45 },
  { symbol: 'HD', date: '2025-07-30', pnl: -425, rMultiple: -2.4, type: 'Short', entry: 385.20, exit: 392.80 },
  { symbol: 'PG', date: '2025-07-17', pnl: -385, rMultiple: -2.1, type: 'Long', entry: 158.60, exit: 155.25 },
  { symbol: 'V', date: '2025-06-25', pnl: -345, rMultiple: -1.9, type: 'Short', entry: 278.40, exit: 283.15 },
  { symbol: 'JNJ', date: '2025-05-20', pnl: -285, rMultiple: -1.6, type: 'Long', entry: 168.25, exit: 165.85 },
  { symbol: 'PLUG', date: '2025-10-13', pnl: -245, rMultiple: -1.4, type: 'Long', entry: 8.45, exit: 7.22 },
  { symbol: 'SNAP', date: '2025-10-02', pnl: -200, rMultiple: -1.3, type: 'Long', entry: 12.80, exit: 10.95 },
  { symbol: 'PINS', date: '2025-09-29', pnl: -200, rMultiple: -1.2, type: 'Long', entry: 28.40, exit: 25.15 },
  { symbol: 'NKLA', date: '2025-10-07', pnl: -160, rMultiple: -1.1, type: 'Long', entry: 1.85, exit: 1.52 },
  { symbol: 'SPCE', date: '2025-10-14', pnl: -180, rMultiple: -1.0, type: 'Long', entry: 5.20, exit: 4.45 },
  { symbol: 'CLOV', date: '2025-10-11', pnl: -125, rMultiple: -0.9, type: 'Long', entry: 2.95, exit: 2.58 },
  { symbol: 'WISH', date: '2025-10-15', pnl: -95, rMultiple: -0.8, type: 'Long', entry: 0.85, exit: 0.72 },
]

const CustomTooltip = ({ active, payload, label }: any) => {
  const { displayMode } = useDisplayMode()

  const formatTooltipValue = (value: number, fieldName: string) => {
    if (!fieldName.includes('PnL') && !fieldName.includes('equity') && !fieldName.includes('pnl')) {
      return value.toLocaleString()
    }

    switch (displayMode) {
      case 'dollar':
        return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      case 'r':
        return `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}R`
      default:
        return value.toString()
    }
  }

  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="studio-surface studio-border rounded-lg p-3 shadow-studio">
        <p className="text-sm studio-muted">{typeof label === 'string' && label.includes('-') ? new Date(label).toLocaleDateString() : label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm">
            <span className="font-medium" style={{ color: entry.color }}>
              {entry.name}:
            </span>
            <span className="ml-1">
              {formatTooltipValue(entry.value, entry.name)}
            </span>
          </p>
        ))}
      </div>
    )
  }
  return null
}

export function AdvancedEquityChart({ trades }: { trades: TraderraTrade[] }) {
  const { getFilteredData, getDateRangeLabel } = useDateRange()
  const { displayMode } = useDisplayMode()
  const { mode } = usePnLMode()

  // Convert real trade data to equity curve data with memoization
  const equityData = useMemo(() => {
    if (!trades || trades.length === 0) return []

    // First filter trades by date range, then process
    const dateFilteredTrades = getFilteredData(trades) || []

    // Sort trades by date
    const sortedTrades = [...dateFilteredTrades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    let cumulativePnL = 0 // Start cumulative P&L at zero for the date range
    let cumulativeR = 0 // Start cumulative R-multiple at zero
    let peak = 0
    let peakR = 0
    const data = []

    // Group trades by date and sum both P&L and R-multiples using correct mode (gross vs net)
    const dailyData = sortedTrades.reduce((acc: { [key: string]: { pnl: number, rMultiple: number } }, trade) => {
      const pnl = getPnLValue(trade, mode)
      const rMultiple = getRMultipleValue(trade, mode)
      if (!acc[trade.date]) {
        acc[trade.date] = { pnl: 0, rMultiple: 0 }
      }
      acc[trade.date].pnl += pnl
      acc[trade.date].rMultiple += rMultiple
      return acc
    }, {})

    // Create equity curve points starting from zero with proper drawdown calculation
    for (const [date, dayData] of Object.entries(dailyData)) {
      cumulativePnL += dayData.pnl
      cumulativeR += dayData.rMultiple

      if (cumulativePnL > peak) {
        peak = cumulativePnL
      }
      if (cumulativeR > peakR) {
        peakR = cumulativeR
      }

      const drawdown = peak - cumulativePnL
      const drawdownR = peakR - cumulativeR

      data.push({
        date,
        equity: cumulativePnL, // Use cumulative P&L for dollar display
        equityR: cumulativeR, // Use cumulative R-multiple for R display
        dailyPnL: dayData.pnl,
        dailyR: dayData.rMultiple,
        cumPnL: cumulativePnL,
        cumR: cumulativeR,
        drawdown: -drawdown, // Negative for display purposes
        drawdownR: -drawdownR // Negative for display purposes
      })
    }

    return data
  }, [trades, mode, getFilteredData, displayMode]) // Re-calculate when trades, PnL mode, date range, or display mode changes

  const filteredData = equityData // Data is already filtered

  const formatValue = (value: number) => {
    switch (displayMode) {
      case 'dollar':
        return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      case 'r':
        return `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}R`
      default:
        return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
  }

  return (
    <div className="chart-container" data-testid="equity-chart">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold studio-text">Equity Curve</h3>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-0.5 bg-yellow-500"></div>
            <span className="studio-muted">Equity</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={380}>
        <AreaChart
          data={filteredData}
          margin={{ top: 5, right: 30, left: 20, bottom: 35 }}
        >
          <defs>
            <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#eab308" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#1a1a1a"
            horizontal={true}
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fill: '#666666', fontSize: 12 }}
            tickLine={{ stroke: '#1a1a1a' }}
            axisLine={{ stroke: '#1a1a1a' }}
            tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            height={60}
          />
          <YAxis
            tick={{ fill: '#666666', fontSize: 12 }}
            tickLine={{ stroke: '#1a1a1a' }}
            axisLine={{ stroke: '#1a1a1a' }}
            domain={displayMode === 'r' ? ['dataMin - 2', 'dataMax + 2'] : ['dataMin - 200', 'dataMax + 200']}
            tickFormatter={formatValue}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey={displayMode === 'r' ? 'equityR' : 'equity'}
            stroke="#eab308"
            strokeWidth={2}
            fill="url(#equityGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function PerformanceDistributionChart({ trades }: { trades: TraderraTrade[] }) {
  const { getFilteredData, getDateRangeLabel } = useDateRange()
  const { displayMode } = useDisplayMode()
  const { mode } = usePnLMode()

  // Convert real trade data to daily P&L distribution with memoization
  const dailyPnLData = useMemo(() => {
    if (!trades || trades.length === 0) return []

    // First filter trades by date range, then process
    const dateFilteredTrades = getFilteredData(trades) || []

    // Group trades by date and sum both P&L and R-multiples using correct mode (gross vs net)
    const dailyData = dateFilteredTrades.reduce((acc: { [key: string]: { pnl: number; rMultiple: number; trades: number } }, trade) => {
      if (!acc[trade.date]) {
        acc[trade.date] = { pnl: 0, rMultiple: 0, trades: 0 }
      }
      const pnl = getPnLValue(trade, mode)
      const rMultiple = getRMultipleValue(trade, mode)
      acc[trade.date].pnl += pnl
      acc[trade.date].rMultiple += rMultiple
      acc[trade.date].trades += 1
      return acc
    }, {})

    // Convert to array format and sort by date (oldest to newest, so newest is on the right)
    return Object.entries(dailyData)
      .map(([date, data]) => ({
        date,
        pnl: data.pnl,
        rMultiple: data.rMultiple,
        trades: data.trades
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [trades, mode, getFilteredData]) // Re-calculate when trades, PnL mode, or date range changes

  // Validate data (already filtered by date range)
  const validatedData = validateDataConsistency(dailyPnLData, 3)
  const filteredData = validatedData

  const formatValue = (value: number) => {
    switch (displayMode) {
      case 'dollar':
        return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      case 'r':
        return `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}R`
      default:
        return value.toString()
    }
  }

  return (
    <div className="chart-container" data-testid="daily-pnl-chart">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold studio-text">Daily P&L Distribution</h3>
        <div className="text-sm studio-muted">{getDateRangeLabel()}</div>
      </div>

      <ResponsiveContainer width="100%" height={380}>
        <BarChart
          data={filteredData}
          margin={{ top: 5, right: 30, left: 20, bottom: 35 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#666666', fontSize: 10 }}
            tickLine={{ stroke: '#1a1a1a' }}
            axisLine={{ stroke: '#1a1a1a' }}
            height={60}
            interval={2}
            tickFormatter={(value) => {
              // Handle both formats: "10/1" and "2024-10-1"
              if (value.includes('/')) return value
              const date = new Date(value)
              return `${date.getMonth() + 1}/${date.getDate()}`
            }}
          />
          <YAxis
            tick={{ fill: '#666666', fontSize: 12 }}
            tickLine={{ stroke: '#1a1a1a' }}
            axisLine={{ stroke: '#1a1a1a' }}
            tickFormatter={formatValue}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey={displayMode === 'r' ? 'rMultiple' : 'pnl'}
            radius={[2, 2, 0, 0]}
          >
            {filteredData.map((entry, index) => {
              const value = displayMode === 'r' ? entry.rMultiple : entry.pnl
              return (
                <Cell key={`cell-${index}`} fill={value > 0 ? '#22c55e' : '#ef4444'} />
              )
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function WinLossChart() {
  const { getDateRangeLabel } = useDateRange()

  return (
    <div className="chart-container">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold studio-text">Win/Loss Ratio</h3>
        <div className="flex items-center space-x-4 text-sm">
          <div className="studio-muted">{getDateRangeLabel()}</div>
          <div className="studio-muted">52.4% Win Rate</div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            <filter id="dropshadow" height="130%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
              <feOffset dx="2" dy="2" result="offset" />
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.5"/>
              </feComponentTransfer>
              <feMerge>
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <Pie
            data={winLossData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            dataKey="value"
            startAngle={90}
            endAngle={450}
            stroke="#1a1a1a"
            strokeWidth={2}
          >
            {winLossData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                filter="url(#dropshadow)"
              />
            ))}
          </Pie>
          <Tooltip
            content={<CustomTooltip />}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="flex justify-center space-x-6 mt-4">
        {winLossData.map((item, index) => (
          <div key={index} className="flex items-center space-x-2">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-sm studio-muted">
              {item.name}: {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SymbolPerformanceChart({ trades }: { trades: TraderraTrade[] }) {
  const [showWins, setShowWins] = useState(true)
  const { getDateRangeLabel, getFilteredData } = useDateRange()
  const { displayMode } = useDisplayMode()
  const { mode } = usePnLMode()

  const formatValue = (value: number) => {
    switch (displayMode) {
      case 'dollar':
        return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      case 'r':
        return `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}R`
      default:
        return value.toString()
    }
  }

  // Use real trade data instead of hardcoded data with memoization
  const symbolPerformanceData = useMemo(() => {
    if (!trades || trades.length === 0) return { winners: [], losers: [], all: [] }

    // First filter trades by date range, then process
    const dateFilteredTrades = getFilteredData(trades) || []

    // Aggregate P&L and R-multiples by symbol from real trades
    const symbolPerformance = dateFilteredTrades.reduce((acc: { [key: string]: { symbol: string; pnl: number; rMultiple: number; trades: number } }, trade) => {
      if (!acc[trade.symbol]) {
        acc[trade.symbol] = { symbol: trade.symbol, pnl: 0, rMultiple: 0, trades: 0 }
      }
      const pnl = getPnLValue(trade, mode)
      const rMultiple = getRMultipleValue(trade, mode)
      acc[trade.symbol].pnl += pnl
      acc[trade.symbol].rMultiple += rMultiple
      acc[trade.symbol].trades += 1
      return acc
    }, {})

    // Convert to array and sort by appropriate value based on display mode (highest to lowest)
    const allSymbols = Object.values(symbolPerformance).sort((a, b) => {
      const aValue = displayMode === 'r' ? a.rMultiple : a.pnl
      const bValue = displayMode === 'r' ? b.rMultiple : b.pnl
      return bValue - aValue
    })

    // Split into winners and losers
    const winners = allSymbols.filter(symbol => {
      const value = displayMode === 'r' ? symbol.rMultiple : symbol.pnl
      return value > 0
    })
    const losers = allSymbols.filter(symbol => {
      const value = displayMode === 'r' ? symbol.rMultiple : symbol.pnl
      return value < 0
    }).sort((a, b) => {
      // For losers, sort by most negative first (biggest losers first)
      const aValue = displayMode === 'r' ? a.rMultiple : a.pnl
      const bValue = displayMode === 'r' ? b.rMultiple : b.pnl
      return aValue - bValue // This will put most negative first
    })

    return { winners, losers, all: allSymbols }
  }, [trades, mode, getFilteredData, displayMode, showWins]) // Re-calculate when trades, PnL mode, date range, display mode, or W/L filter changes

  const displayData = showWins ? symbolPerformanceData.winners : symbolPerformanceData.losers

  return (
    <div className="chart-container" data-testid="symbol-performance">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold studio-text">Symbol Performance</h3>
        <div className="flex items-center space-x-4">
          <div className="text-sm studio-muted">
            {displayData.length} symbols
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowWins(true)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                showWins ? 'bg-green-600 text-white' : 'studio-muted hover:studio-text'
              }`}
              data-testid="symbol-toggle-wins"
            >
              W
            </button>
            <button
              onClick={() => setShowWins(false)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                !showWins ? 'bg-red-600 text-white' : 'studio-muted hover:studio-text'
              }`}
              data-testid="symbol-toggle-losses"
            >
              L
            </button>
          </div>
        </div>
      </div>

      {displayData.length === 0 ? (
        <div className="h-80 flex items-center justify-center text-center">
          <div className="studio-muted">
            <p>No symbol data available for the selected date range</p>
            <p className="text-xs mt-2">Try expanding your date range to see more data</p>
          </div>
        </div>
      ) : (
        <div className="h-80 overflow-y-auto space-y-2 hover:scrollbar-thin hover:scrollbar-track-[#1a1a1a] hover:scrollbar-thumb-[#333333]">
          {displayData.map((entry, index) => {
            const currentValue = displayMode === 'r' ? entry.rMultiple : entry.pnl
            const isPositive = currentValue > 0
            const maxAbsValue = Math.max(...displayData.map(d => {
              const value = displayMode === 'r' ? d.rMultiple : d.pnl
              return Math.abs(value)
            }))
            const barWidth = maxAbsValue > 0 ? Math.abs(currentValue) / maxAbsValue * 100 : 0

          return (
            <div key={entry.symbol} className="flex items-center" data-testid="symbol-item">
              <div className="w-12 text-xs studio-text text-right mr-3">
                {entry.symbol}
              </div>
              <div className="flex-1 relative h-4 bg-[#1a1a1a] rounded-xs overflow-hidden">
                <div
                  className={`h-full rounded-xs transition-all duration-300 ${
                    isPositive ? 'bg-green-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <div className="ml-3 text-xs studio-text min-w-[80px] text-right">
                {formatValue(currentValue)}
              </div>
            </div>
          )
        })}
        </div>
      )}
    </div>
  )
}

export function BiggestTradesChart({ trades }: { trades: TraderraTrade[] }) {
  const [showWins, setShowWins] = useState(true)
  const { getDateRangeLabel, getFilteredData } = useDateRange()
  const { mode } = usePnLMode()

  // Convert real trade data to best/worst trades format with memoization
  const { bestTrades, worstTrades } = useMemo(() => {
    if (!trades || trades.length === 0) return { bestTrades: [], worstTrades: [] }

    // First filter trades by date range, then process
    const dateFilteredTrades = getFilteredData(trades) || []

    // Convert trades to the expected format and sort using correct mode (gross vs net)
    const formattedTrades = dateFilteredTrades.map(trade => {
      const pnl = getPnLValue(trade, mode)
      const rMultiple = getRMultipleValue(trade, mode)
      return {
        symbol: trade.symbol,
        date: trade.date,
        pnl: pnl,
        rMultiple: rMultiple,
        type: trade.side,
        entry: trade.entryPrice,
        exit: trade.exitPrice
      }
    })

    // Sort and get best trades (positive P&L)
    const bestTrades = formattedTrades
      .filter(trade => trade.pnl > 0)
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 15)

    // Sort and get worst trades (negative P&L)
    const worstTrades = formattedTrades
      .filter(trade => trade.pnl < 0)
      .sort((a, b) => a.pnl - b.pnl)
      .slice(0, 15)

    return { bestTrades, worstTrades }
  }, [trades, mode, getFilteredData]) // Re-calculate when trades, PnL mode, or date range changes

  const currentData = showWins ? bestTrades : worstTrades

  return (
    <div className="chart-container" data-testid="best-trades">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold studio-text">
          {showWins ? 'Best' : 'Worst'} Trades
        </h3>
        <div className="flex items-center space-x-4">
          <div className="text-sm studio-muted">
            {currentData.length} trades
          </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowWins(true)}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              showWins ? 'bg-green-600 text-white' : 'studio-muted hover:studio-text'
            }`}
            data-testid="trades-toggle-wins"
          >
            W
          </button>
          <button
            onClick={() => setShowWins(false)}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              !showWins ? 'bg-red-600 text-white' : 'studio-muted hover:studio-text'
            }`}
            data-testid="trades-toggle-losses"
          >
            L
          </button>
        </div>
        </div>
      </div>

      {currentData.length === 0 ? (
        <div className="h-80 flex items-center justify-center text-center">
          <div className="studio-muted">
            <p>No {showWins ? 'profitable' : 'losing'} trades available for the selected date range</p>
            <p className="text-xs mt-2">Try expanding your date range to see more data</p>
          </div>
        </div>
      ) : (
        <div className="h-80 overflow-y-auto space-y-3 hover:scrollbar-thin hover:scrollbar-track-[#1a1a1a] hover:scrollbar-thumb-[#333333]">
          {currentData.map((trade, index) => (
          <div key={index} className="flex items-center justify-between p-3 studio-surface rounded-lg border studio-border" data-testid="trade-item">
            <div className="flex items-center space-x-3">
              <div className="text-sm font-semibold studio-text">
                {trade.symbol}
              </div>
              <div className="text-xs studio-muted">
                {trade.date} • <span className={trade.type === 'Long' ? 'text-green-400' : 'text-red-400'}>{trade.type}</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-xs studio-muted">
                {trade.entry.toFixed(2)} → {trade.exit.toFixed(2)}
              </div>
              <div className={`text-sm font-semibold ${
                trade.pnl > 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                ${trade.pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className={`text-xs ${
                trade.rMultiple > 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {trade.rMultiple > 0 ? '+' : ''}{trade.rMultiple.toFixed(2)}R
              </div>
            </div>
          </div>
        ))}
        </div>
      )}
    </div>
  )
}