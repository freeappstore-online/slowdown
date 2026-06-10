export type UserPlan = 'free' | 'pro'

export interface AppUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  plan: UserPlan
}
