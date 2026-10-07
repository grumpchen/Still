import { createRoot } from 'react-dom/client';
import { isTauri } from '@tauri-apps/api/core';
import App from './App.tsx';
import './styles.css';
import './canvas.css';
if(isTauri())document.documentElement.classList.add('native-transparent');
createRoot(document.getElementById('root')!).render(<App/>);
