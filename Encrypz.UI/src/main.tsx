import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import axios from 'axios'
import { lockVault } from './utils/crypto'

axios.defaults.withCredentials = true
axios.interceptors.response.use(response => response, error => {
  if (error.response?.status === 401 && !['/login', '/register'].includes(window.location.pathname)) {
    lockVault(); sessionStorage.clear(); window.location.assign('/login');
  }
  return Promise.reject(error);
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
