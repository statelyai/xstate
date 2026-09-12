import './index.css';
import { createRoot } from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing root element');
createRoot(rootElement).render(<App />);
