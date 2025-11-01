import React, { useState } from 'react';
import { Box, Chip, Collapse, List, ListItem, ListItemText, Typography } from '@mui/material';
import * as types from '../types';

interface TagDetailsProps {
  tagScores: [string, { score: number; questions: string[] }][];
  questionBank: types.QuestionBank | null;
}

const TagDetails: React.FC<TagDetailsProps> = ({ tagScores, questionBank }) => {
  const [expandedTag, setExpandedTag] = useState<string | null>(null);

  const handleTagClick = (tag: string) => {
    setExpandedTag(expandedTag === tag ? null : tag);
  };

  const getQuestionPrompt = (questionId: string): string => {
    if (!questionBank) return '';
    const likertQ = questionBank.likert.find(q => q.id === questionId);
    if (likertQ) return likertQ.prompt;
    const forcedQ = questionBank.forcedChoice.find(q => q.id === questionId);
    if (forcedQ) return forcedQ.prompt;
    const scenarioQ = questionBank.scenario.find(q => q.id === questionId);
    if (scenarioQ) return scenarioQ.title;
    return '';
  };

  return (
    <Box>
      <Typography variant="h6">興味・関心のあるキーワード</Typography>
      <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
        {tagScores.map(([tag, { score }]) => (
          <Chip key={tag} label={`${tag} (${score.toFixed(2)})`} onClick={() => handleTagClick(tag)} />
        ))}
      </Box>
      <Collapse in={expandedTag !== null}>
        {expandedTag && (
          <List>
            {tagScores.find(([tag]) => tag === expandedTag)?.[1].questions.map(qId => (
              <ListItem key={qId}>
                <ListItemText primary={getQuestionPrompt(qId)} />
              </ListItem>
            ))}
          </List>
        )}
      </Collapse>
    </Box>
  );
};

export default TagDetails;
