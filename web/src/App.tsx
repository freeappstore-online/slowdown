import { Routes, Route } from 'react-router-dom'
import { Shell } from './components/Shell.tsx'

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </Shell>
  )
}

function Home() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <h1 className="display-font text-3xl font-bold text-[var(--ink)]">slowdown</h1>
    </div>
  )
}
