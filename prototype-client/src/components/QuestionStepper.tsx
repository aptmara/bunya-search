import React from 'react';
import { Stepper, Step, StepLabel, useTheme, useMediaQuery } from '@mui/material';

interface QuestionStepperProps {
  activeStep: number;
  steps: { key: string; label: string; icon: React.ReactNode }[];
}

const QuestionStepper: React.FC<QuestionStepperProps> = ({ activeStep, steps }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Stepper activeStep={activeStep} alternativeLabel={!isMobile} orientation={isMobile ? 'vertical' : 'horizontal'} sx={{ mb: 4 }}>
      {steps.map(({ key, label, icon }) => (
        <Step key={key}>
          <StepLabel StepIconComponent={() => icon}>{!isMobile && label}</StepLabel>
        </Step>
      ))}
    </Stepper>
  );
};

export default QuestionStepper;
