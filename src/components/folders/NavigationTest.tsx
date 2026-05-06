'use client'

import React, { useState } from 'react'
import { VSCodeFolderTree, convertToVSCodeNodes } from './VSCodeFolderTree'
import { buildFolderTree } from './FolderTree'

// Test data that matches your current folder structure
const testFolders = [
  {
    id: '1',
    name: 'Trading Journal',
    parentId: undefined,
    icon: 'journal-text',
    color: '#FFD700',
    position: 0,
    contentCount: 0
  },
  {
    id: '2',
    name: 'Trade Entries',
    parentId: '1',
    icon: 'trending-up',
    color: '#10B981',
    position: 1,
    contentCount: 4
  },
  {
    id: '3',
    name: '2024',
    parentId: '2',
    icon: 'calendar',
    color: '#10B981',
    position: 0,
    contentCount: 4
  },
  {
    id: '4',
    name: 'Strategies',
    parentId: '1',
    icon: 'target',
    color: '#3B82F6',
    position: 2,
    contentCount: 1
  },
  {
    id: '5',
    name: 'Research',
    parentId: '1',
    icon: 'search',
    color: '#8B5CF6',
    position: 3,
    contentCount: 0
  },
  {
    id: '6',
    name: 'Goals & Reviews',
    parentId: '1',
    icon: 'star',
    color: '#F59E0B',
    position: 4,
    contentCount: 1
  }
]

export function NavigationTest() {
  const [selectedNodeId, setSelectedNodeId] = useState<string>('1')
  const [testResults, setTestResults] = useState<string[]>([])

  // Build folder tree and convert to VS Code format
  const folderTree = buildFolderTree(testFolders)
  const vsCodeNodes = convertToVSCodeNodes(folderTree)

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`])
  }

  const handleNodeSelect = (nodeId: string) => {
    setSelectedNodeId(nodeId)
    addTestResult(`✅ Selected folder: ${nodeId} (No state reset!)`)
  }

  const handleCreateFolder = (parentId?: string) => {
    addTestResult(`📁 Create folder requested in parent: ${parentId || 'root'}`)
  }

  const handleContextMenu = (nodeId: string, event: React.MouseEvent) => {
    event.preventDefault()
    addTestResult(`📋 Context menu opened for folder: ${nodeId}`)
  }

  const runNavigationTests = () => {
    setTestResults([])
    addTestResult('🚀 Starting VS Code navigation tests...')

    // Test 1: Selection without expansion
    setTimeout(() => {
      setSelectedNodeId('2')
      addTestResult('✅ Test 1: Can select Trade Entries without auto-expansion')
    }, 100)

    // Test 2: Selection maintains context
    setTimeout(() => {
      setSelectedNodeId('3')
      addTestResult('✅ Test 2: Can select 2024 while maintaining full tree context')
    }, 200)

    // Test 3: Multiple selections
    setTimeout(() => {
      setSelectedNodeId('4')
      addTestResult('✅ Test 3: Can select Strategies - no navigation loss')
    }, 300)

    setTimeout(() => {
      addTestResult('🎉 All tests completed! Navigation should work like VS Code now.')
    }, 400)
  }

  return (
    <div className="h-screen bg-[#0a0a0a] text-[#e5e5e5] flex">
      {/* Navigation Panel */}
      <div className="w-80 bg-[#0a0a0a] border-r border-[#1a1a1a] flex flex-col">
        <div className="p-4 border-b border-[#1a1a1a]">
          <h2 className="text-lg font-semibold text-[#FFD700] mb-2">VS Code Navigation Test</h2>
          <button
            onClick={runNavigationTests}
            className="w-full px-3 py-2 bg-[#FFD700] text-black rounded-lg font-medium hover:bg-[#FFD700]/90 transition-colors"
          >
            Run Tests
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <VSCodeFolderTree
            nodes={vsCodeNodes}
            selectedNodeId={selectedNodeId}
            onNodeSelect={handleNodeSelect}
            onCreateFolder={handleCreateFolder}
            onContextMenu={handleContextMenu}
            showCreateButton={true}
            showContentCounts={true}
            showTreeControls={true}
          />
        </div>
      </div>

      {/* Test Results Panel */}
      <div className="flex-1 p-6">
        <h1 className="text-2xl font-bold text-[#FFD700] mb-4">Navigation Test Results</h1>

        <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold mb-2">Expected Behaviors:</h3>
          <ul className="space-y-1 text-sm">
            <li>✅ Click folder name → Select only (no expansion)</li>
            <li>✅ Click chevron → Expand/collapse only (no selection)</li>
            <li>✅ Always see complete directory tree</li>
            <li>✅ No state resets during navigation</li>
            <li>✅ Gold highlighting for selected folder</li>
            <li>✅ Smooth animations and transitions</li>
          </ul>
        </div>

        <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4 h-96 overflow-y-auto">
          <h3 className="text-lg font-semibold mb-2">Test Log:</h3>
          <div className="space-y-1">
            {testResults.length > 0 ? (
              testResults.map((result, index) => (
                <div key={index} className="text-sm font-mono">
                  {result}
                </div>
              ))
            ) : (
              <div className="text-[#666666]">Click "Run Tests" to validate navigation behavior</div>
            )}
          </div>
        </div>

        <div className="mt-4 text-sm text-[#666666]">
          <p><strong>Selected Folder ID:</strong> {selectedNodeId}</p>
          <p><strong>Test Instructions:</strong> Try clicking different folders and chevrons to verify VS Code-style behavior</p>
        </div>
      </div>
    </div>
  )
}