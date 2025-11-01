import React from 'react';
import Grid from '@mui/material/Grid';
import { Box, Button, Card, CardContent, CardHeader, TextField } from '@mui/material';
import type { ProfilePayload } from '../types';

interface ProfileStepProps {
  profile: ProfilePayload;
  onProfileChange: (key: keyof ProfilePayload, value: ProfilePayload[keyof ProfilePayload]) => void;
  onProceed: () => void;
  onResume: () => void;
  hasSavedData: boolean;
}

const ProfileStep: React.FC<ProfileStepProps> = ({ profile, onProfileChange, onProceed, onResume, hasSavedData }) => {
  return (
    <Card>
      <CardHeader title="診断前に教えてください" />
      <CardContent>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="ニックネーム"
              value={profile.nickname}
              placeholder="例: 進路探求中"
              onChange={(e) => onProfileChange('nickname', e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="学年"
              value={profile.grade}
              placeholder="例: 高校2年"
              onChange={(e) => onProfileChange('grade', e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="文理・コース"
              value={profile.track}
              placeholder="例: 理系 / 総合学科"
              onChange={(e) => onProfileChange('track', e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              type="email"
              label="連絡先（任意）"
              value={profile.email}
              placeholder="結果共有を希望する場合のみ入力"
              onChange={(e) => onProfileChange('email', e.target.value)}
            />
          </Grid>
        </Grid>
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          {hasSavedData && (
            <Button variant="outlined" onClick={onResume}>
              前回の続きから
            </Button>
          )}
          <Button
            variant="contained"
            onClick={onProceed}
            disabled={!profile.nickname || !profile.grade}
          >
            設問に進む
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ProfileStep;


