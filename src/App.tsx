import { Dashboard } from './components/Dashboard';
import { Toaster } from 'sonner';
import './App.css';

function App() {
  return (
    <>
      <Dashboard />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'hsl(var(--background))',
            color: 'hsl(var(--foreground))',
            border: '1px solid hsl(var(--border))'
          }
        }}
      />
    </>
  );
}

export default App;
