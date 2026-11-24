import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './styles.css';
import App from './App';
import { TrackerProvider } from './state/TrackerContext';
import { IndexedDbRepository } from './storage/indexedDbRepository';
import { loadBundledProgram } from './storage/staticProgramRepository';

const program = loadBundledProgram();
const repo = new IndexedDbRepository();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TrackerProvider program={program} repo={repo}>
      <App />
    </TrackerProvider>
  </StrictMode>,
);
