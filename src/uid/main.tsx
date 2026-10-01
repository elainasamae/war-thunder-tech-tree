import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import UidPage from './UidPage';
import './uid.css';
createRoot(document.getElementById('root')!).render(<StrictMode><UidPage /></StrictMode>);
