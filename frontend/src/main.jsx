import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import App from './App.jsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

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
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>,
)

