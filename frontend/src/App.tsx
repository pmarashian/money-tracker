import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [health, setHealth] = useState<string>('Loading...')

  useEffect(() => {
    // Test backend connection
    fetch('http://localhost:3001/api/health')
      .then(res => res.json())
      .then(data => setHealth(data.message))
      .catch(() => setHealth('Backend not running'))
  }, [])

  return (
    <div className="App">
      <header className="App-header">
        <h1>💰 Money Tracker</h1>
        <p>Track your expenses across platforms</p>
        <p>Backend Status: {health}</p>
      </header>
    </div>
  )
}

export default App