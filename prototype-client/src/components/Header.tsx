import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';

interface HeaderProps {
  onExport: () => void;
  onReset: () => void;
  lastSaved: Date | null;
}

const Header: React.FC<HeaderProps> = ({ onExport, onReset, lastSaved }) => {
  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          大学分野診断 β
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {lastSaved && (
            <Typography variant="caption">
              最終保存: {lastSaved.toLocaleTimeString()}
            </Typography>
          )}
          <Button color="inherit" onClick={onExport}>
            ローカルにエクスポート
          </Button>
          <Button color="inherit" onClick={() => {
            if (window.confirm('回答データをすべてリセットしますか？')) {
              onReset();
            }
          }}>
            回答をリセット
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
