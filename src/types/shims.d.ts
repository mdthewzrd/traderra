// Type shims for packages that ship no (or incomplete) type declarations.

// @copilotkit/react-textarea is an optional/uninstalled CopilotKit sub-package.
declare module '@copilotkit/react-textarea' {
  import type { ComponentType } from 'react'
  export const CopilotTextarea: ComponentType<any>
}
