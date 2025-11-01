import React from 'react';
import { Box, Button, Card, CardContent, CardHeader, Chip, LinearProgress, Typography } from '@mui/material';
import type { LikertQuestion } from '../types';

interface LikertStepProps {
  question: LikertQuestion;
  currentAnswer: number | undefined;
  requiredLikertAnswered: number;
  requiredLikertCount: number;
  totalLikertQuestions: number;
  onAnswer: (value: number) => void;
}

const LikertStep: React.FC<LikertStepProps> = ({
  question,
  currentAnswer,
  requiredLikertAnswered,
  requiredLikertCount,
  totalLikertQuestions,
  onAnswer,
}) => {
  const progress = Math.round((requiredLikertAnswered / requiredLikertCount) * 100);

  return (
    <Card>
      <CardHeader
        title={question.prompt}
        subheader={`必須回答: ${requiredLikertAnswered}/${requiredLikertCount}・総回答: ${totalLikertQuestions}`}
        action={<Chip label={`${question.axis} / ${question.primaryCategory}`} />}
      />
      <CardContent>
        <Box sx={{ mb: 2 }}>
          <LinearProgress variant="determinate" value={progress} />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mt: 2, flexWrap: 'wrap' }}>
          {[1, 2, 3, 4, 5, 6, 7].map((value) => (
            <Button
              key={value}
              variant={currentAnswer === value ? 'contained' : 'outlined'}
              onClick={() => onAnswer(value)}
              sx={{
                flex: '1 0 10%',
                transition: 'transform 0.15s ease-in-out',
                '&:hover': {
                  transform: 'scale(1.05)',
                },
              }}
            >
              {value}
            </Button>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

export default LikertStep;
