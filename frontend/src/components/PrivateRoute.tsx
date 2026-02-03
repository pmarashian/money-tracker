import React, { useEffect, useState } from 'react'
import { Route, RouteProps, useHistory } from 'react-router-dom'
import { IonLoading } from '@ionic/react'
import { apiClient } from '../utils/api'

interface PrivateRouteProps extends RouteProps {
  component: React.ComponentType<any>
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ component: Component, ...rest }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const history = useHistory()

  useEffect(() => {
    checkAuthentication()
  }, [])

  const checkAuthentication = async () => {
    try {
      const response = await apiClient.get('/api/auth/session')

      if (!response.error) {
        // Response data exists, so authenticated
        setIsAuthenticated(true)
      } else {
        setIsAuthenticated(false)
        // Redirect to login if not authenticated
        history.replace('/login')
      }
    } catch (err) {
      console.error('Session check failed:', err)
      setIsAuthenticated(false)
      // Redirect to login on network error
      history.replace('/login')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <IonLoading isOpen={loading} message="Checking authentication..." />
      </div>
    )
  }

  if (isAuthenticated === false) {
    // Return null while redirecting
    return null
  }

  return (
    <Route
      {...rest}
      render={(props) => <Component {...props} />}
    />
  )
}

export default PrivateRoute