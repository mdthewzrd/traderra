// Sole owner of the Traderra account — always granted role: owner + status: approved
// even if the database is reset. Add more admin emails to ADMINS as needed.
export const OWNER_EMAIL = 'mikedurante13@gmail.com'

export const ADMINS: string[] = []

export const ROLES = ['owner', 'admin', 'user'] as const
export const STATUSES = ['pending', 'approved', 'rejected'] as const

export type Role = (typeof ROLES)[number]
export type UserStatus = (typeof STATUSES)[number]

export function isPriviledgedEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const e = email.toLowerCase()
  return e === OWNER_EMAIL.toLowerCase() || ADMINS.map(a => a.toLowerCase()).includes(e)
}

export function isAdminRole(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'admin'
}
