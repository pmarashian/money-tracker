export interface User {
  id: string
  email: string
  createdAt: string
}

export async function checkAuth(): Promise<User | null> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/session`, {
      credentials: 'include',
    })

    if (response.ok) {
      const data = await response.json()
      return data.user || null
    }

    return null
  } catch (err) {
    console.error('Auth check failed:', err)
    return null
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    })
  } catch (err) {
    console.error('Logout failed:', err)
  }
}