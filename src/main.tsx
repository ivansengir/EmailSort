// import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  // StrictMode disabled temporarily for debugging auth issues
  // <StrictMode>
    <App />
  // </StrictMode>
);
