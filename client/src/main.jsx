import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// Без StrictMode — он монтирует дважды в dev режиме,
// создавая два рендерера и два сокета
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
