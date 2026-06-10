import { useState, useEffect, useCallback } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth'
import { auth, isMockMode } from '../lib/firebase.ts'

interface AuthState {
  user: User | null
  loading: boolean
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ user: null, loading: !isMockMode })

  useEffect(() => {
    if (isMockMode || !auth) {
      setState({ user: null, loading: false })
      return
    }
    const unsub = onAuthStateChanged(auth, (user) => {
      setState({ user, loading: false })
    })
    return unsub
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!auth) return
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
  }, [])

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (!auth) return
    await signInWithEmailAndPassword(auth, email, password)
  }, [])

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    if (!auth) return
    await createUserWithEmailAndPassword(auth, email, password)
  }, [])

  const signOut = useCallback(async () => {
    if (!auth) return
    await firebaseSignOut(auth)
  }, [])

  return {
    user: state.user,
    loading: state.loading,
    isMockMode,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  }
}
