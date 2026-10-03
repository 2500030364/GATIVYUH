import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './landing.css'
import { ExperienceRouter } from './components/ExperienceRouter'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ExperienceRouter />
  </StrictMode>,
)
