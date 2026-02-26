import React from 'react';
import ReactDOM from 'react-dom/client';
import { initializeStrapiImage } from 'strapi-next-image';
import App from './App';
import './App.css';

// Fetch image optimization config from the Strapi backend
initializeStrapiImage('http://localhost:1337');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
