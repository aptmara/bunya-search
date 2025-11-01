import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { GlobalStyles } from '@mui/material';
import theme from './theme';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles
        styles={{
          body: {
            backgroundColor: theme.palette.background.default,
            backgroundImage: `radial-gradient(${theme.palette.grey[200]} 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          },
        }}
      />
      <App />
    </ThemeProvider>
  </StrictMode>,
);
