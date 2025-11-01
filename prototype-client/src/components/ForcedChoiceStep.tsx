import React from 'react';
import Grid from '@mui/material/Grid';
import { Box, Button, Card, CardContent, CardHeader, LinearProgress, Slider, Typography } from '@mui/material';
import type { ForcedChoiceQuestion } from '../types';

interface ForcedChoiceStepProps {
  question: ForcedChoiceQuestion;
  forcedAnswers: Record<string, { optionKey: string; confidence: number }>;
  forcedIndex: number;
  forcedOrderLength: number;
  onAnswer: (question: ForcedChoiceQuestion, optionKey: string, confidence: number) => void;
  onProceed: () => void;
  onSkip: (question: ForcedChoiceQuestion) => void;
}

const ForcedChoiceStep: React.FC<ForcedChoiceStepProps> = ({
  question,
  forcedAnswers,
  forcedIndex,
  forcedOrderLength,
  onAnswer,
  onProceed,
  onSkip,
}) => {
  const progress = Math.round(((forcedIndex + 1) / forcedOrderLength) * 100);

  return (
    <Card>
      <CardHeader
        title={question.prompt}
        subheader={`二択設問 ${forcedIndex + 1}/${forcedOrderLength}`}
      />
      <CardContent>
        <Box sx={{ mb: 2 }}>
          <LinearProgress variant="determinate" value={progress} />
        </Box>
        <Grid container spacing={2}>
          {question.options.map((option) => {
            const optionKey = `${question.id}|${option.key}`;
            const selected = Boolean(forcedAnswers[optionKey]);
            return (
              <Grid size={{ xs: 12, md: 6 }} key={option.key}>
                <Card
                  variant={selected ? 'outlined' : 'elevation'}
                  sx={{
                    cursor: 'pointer',
                    borderColor: selected ? 'primary.main' : 'divider',
                    borderWidth: 2,
                    transition: 'transform 0.15s ease-in-out, box-shadow 0.15s ease-in-out',
                    '&:hover': {
                      transform: 'scale(1.02)',
                      boxShadow: 6,
                    },
                  }}
                  onClick={() => {
                    onAnswer(question, option.key, forcedAnswers[optionKey]?.confidence ?? 0.7);
                  }}
                >
                  <CardContent>
                    <Typography variant="h6" component="div">{option.key}</Typography>
                    <Typography>{option.label}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
        <Box sx={{ mt: 3 }}>
          <Typography gutterBottom>自信度</Typography>
          <Slider
            min={0.5}
            max={1}
            step={0.1}
            value={
              question.options
                .map((option) => forcedAnswers[`${question.id}|${option.key}`]?.confidence)
                .find((val) => val !== undefined) ?? 0.7
            }
            onChange={(_, value) => {
              const selectedOption = question.options.find((option) =>
                forcedAnswers[`${question.id}|${option.key}`],
              );
              if (selectedOption) {
                onAnswer(question, selectedOption.key, value as number);
              }
            }}
            valueLabelDisplay="auto"
          />
        </Box>
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button variant="text" onClick={() => onSkip(question)}>
            どちらでもない
          </Button>
          <Button
            variant="contained"
            disabled={
              !question.options.some(
                (option) => forcedAnswers[`${question.id}|${option.key}`],
              )
            }
            onClick={onProceed}
          >
            次へ
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ForcedChoiceStep;


