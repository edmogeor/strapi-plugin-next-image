import React from 'react';
import ReactDOM from 'react-dom/client';
import { configure } from 'strapi-next-image';
import App from './App';
import './App.css';

// Demo: customize image config at app entry point
configure({
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  imageSizes: [32, 48, 64, 96, 128, 256, 384],
  qualities: [75],
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
