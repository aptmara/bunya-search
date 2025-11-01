import React, { useState, useEffect } from 'react';
import Grid from '@mui/material/Grid';
import { Box, Button, Card, CardContent, CardHeader, LinearProgress, Typography, IconButton } from '@mui/material';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import ArrowDownward from '@mui/icons-material/ArrowDownward';
import type { ScenarioQuestion, ScenarioOption } from '../types';

interface ScenarioStepProps {
  question: ScenarioQuestion;
  scenarioAnswers: Record<string, { rankedOptions: string[] }>;
  scenarioIndex: number;
  scenarioOrderLength: number;
  onAnswer: (question: ScenarioQuestion, rankedOptions: string[]) => void;
  onProceed: () => void;
}

const ScenarioStep: React.FC<ScenarioStepProps> = ({
  question,
  scenarioAnswers,
  scenarioIndex,
  scenarioOrderLength,
  onAnswer,
  onProceed,
}) => {
  const progress = Math.round(((scenarioIndex + 1) / scenarioOrderLength) * 100);
  const [rankedOptions, setRankedOptions] = useState<ScenarioOption[]>(question.options);

  useEffect(() => {
    const previousRanking = scenarioAnswers[question.id]?.rankedOptions;
    if (previousRanking) {
      const sortedOptions = [...question.options].sort((a, b) => {
        return previousRanking.indexOf(a.key) - previousRanking.indexOf(b.key);
      });
      setRankedOptions(sortedOptions);
    } else {
      setRankedOptions(question.options);
    }
  }, [question, scenarioAnswers]);

  const moveOption = (index: number, direction: 'up' | 'down') => {
    const newRankedOptions = [...rankedOptions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newRankedOptions.length) return;

    const [movedOption] = newRankedOptions.splice(index, 1);
    newRankedOptions.splice(targetIndex, 0, movedOption);

    setRankedOptions(newRankedOptions);
  };

  const handleProceed = () => {
    const rankedKeys = rankedOptions.map(opt => opt.key);
    onAnswer(question, rankedKeys);
    onProceed();
  }

  return (
    <Card>
      <CardHeader
        title={question.title}
        subheader={`シナリオ ${scenarioIndex + 1}/${scenarioOrderLength}`}
      />
      <CardContent>
        <Box sx={{ mb: 2 }}>
          <LinearProgress variant="determinate" value={progress} />
        </Box>
        <Typography variant="body1" sx={{ mb: 3 }}>{question.scenario}</Typography>
        <Typography variant="subtitle1" gutterBottom>魅力を感じる順に選択肢を並び替えてください。</Typography>
        <Grid container spacing={2}>
          {rankedOptions.map((option, index) => (
            <Grid size={12} key={option.key}>
              <Card variant="outlined" sx={{ display: 'flex', alignItems: 'center', p: 1 }}>
                <Typography variant="h4" sx={{ px: 2 }}>{index + 1}</Typography>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" component="div">{option.key}</Typography>
                  <Typography>{option.label}</Typography>
                </CardContent>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <IconButton onClick={() => moveOption(index, 'up')} disabled={index === 0}>
                    <ArrowUpward />
                  </IconButton>
                  <IconButton onClick={() => moveOption(index, 'down')} disabled={index === rankedOptions.length - 1}>
                    <ArrowDownward />
                  </IconButton>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
        <Box sx={{ mt: 3, textAlign: 'right' }}>
          <Button
            variant="contained"
            onClick={handleProceed}
          >
            次へ
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ScenarioStep;


