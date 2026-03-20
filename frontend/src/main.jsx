import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Import auto-populate script for development/testing
if (import.meta.env.DEV) {
  import('./utils/testData.js').then(({ autoPopulate, clearTestData }) => {
    // Make functions available globally for console access
    window.autoPopulateFull = () => autoPopulate('full');
    window.autoPopulateMinimal = () => autoPopulate('minimal');
    window.clearTestData = clearTestData;

    console.log(`
🚀 TT-Scheduler Development Mode

Auto-populate commands available:
• autoPopulateFull() - Complete school data
• autoPopulateMinimal() - Minimal test data
• clearTestData() - Clear all data

After running, refresh and go to /screen-8 to see your data!
    `);
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
