import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const debugInfo = {
      timestamp: new Date().toISOString(),
      request: {
        hasMessage: !!body.message,
        messagePreview: body.message?.substring(0, 100) || 'No message',
        hasAttachedFile: !!body.attachedFile,
        attachedFileName: body.attachedFile?.name || 'No file name',
        hasFileContent: !!body.attachedFile?.content,
        fileContentLength: body.attachedFile?.content?.length || 0,
        fileContentPreview: body.attachedFile?.content?.substring(0, 50) || 'No content'
      },
      processing: {
        fileDetected: !!(body.attachedFile && body.attachedFile.name && body.attachedFile.content),
        wouldProcess: !!(body.attachedFile?.name && body.attachedFile?.content)
      }
    }

    // Simulate file processing
    if (body.attachedFile?.name && body.attachedFile?.content) {
      try {
        const csvBytes = Buffer.from(body.attachedFile.content, 'base64')

        // Node.js doesn't support 'utf-8-sig', so we use utf-8 and manually remove BOM if present
        let csvText = csvBytes.toString('utf-8')

        // Remove UTF-8 BOM if present (EF BB BF)
        if (csvBytes.length >= 3 && csvBytes[0] === 0xEF && csvBytes[1] === 0xBB && csvBytes[2] === 0xBF) {
          csvText = csvText.slice(1) // Remove the BOM character
        }

        const lines = csvText.split('\n').filter(line => line.trim())

        debugInfo.processing.csvParse = {
          decodedByteLength: csvBytes.length,
          decodedTextLength: csvText.length,
          linesFound: lines.length,
          tradeCount: Math.max(0, lines.length - 1),
          headerLine: lines[0] || 'No header',
          firstDataLine: lines[1] || 'No data'
        }

        // Create file info
        const fileInfo = `\n\n[📎 FILE UPLOADED: ${body.attachedFile.name}]
- Type: CSV file with ${Math.max(0, lines.length - 1)} trade(s)
- Columns: ${lines[0]?.split(',').slice(0, 5).join(', ') || 'unknown'}
- Status: File received successfully and ready for import`

        debugInfo.processing.fileInfoCreated = true
        debugInfo.processing.fileInfoPreview = fileInfo.substring(0, 150)
        debugInfo.processing.wouldAddToMessage = !!body.message

        // Simulate final message
        const finalMessage = body.message
          ? body.message + fileInfo
          : fileInfo

        debugInfo.processing.finalMessagePreview = finalMessage.substring(0, 200)
        debugInfo.processing.containsFileMarker = finalMessage.includes('📎 FILE UPLOADED')
        debugInfo.processing.containsStatusReceived = finalMessage.includes('received successfully')

      } catch (error) {
        debugInfo.processing.error = {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'Unknown'
        }
      }
    }

    return NextResponse.json({
      success: true,
      debug: debugInfo
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 400 })
  }
}
