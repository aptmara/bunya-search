
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchQuestionBank, submitResponses, fetchCareerMap, fetchCategoryDetails, fetchAptitudeDetails, fetchRecommendations } from './api';
import type {
  QuestionBank,
  LikertQuestion,
  ForcedChoiceQuestion,
  ScenarioQuestion,
  ResponsePayload,
  ProfilePayload,
  AptitudeDetails,
  RecommendationItem,
} from './types';
import {
  pickNextLikertQuestion,
  recomputeAxisStats,
  computeAxisAverage,
} from './utils';
import { Box, Button, Card, CardContent, Container, Fade, LinearProgress, Typography } from '@mui/material';
import AccountCircle from '@mui/icons-material/AccountCircle';
import Psychology from '@mui/icons-material/Psychology';
import CompareArrows from '@mui/icons-material/CompareArrows';
import Movie from '@mui/icons-material/Movie';
import BarChart from '@mui/icons-material/BarChart';
import Header from './components/Header';
import QuestionStepper from './components/QuestionStepper';
import ProfileStep from './components/ProfileStep';
import LikertStep from './components/LikertStep';
import ForcedChoiceStep from './components/ForcedChoiceStep';
import ScenarioStep from './components/ScenarioStep';
import ResultStep from './components/ResultStep';

type StepId = 'profile' | 'likert' | 'forced-choice' | 'scenario' | 'result';

interface LikertAnswerState {
  value: number;
  responseTimeMs?: number;
}

interface ForcedAnswerState {
  optionKey: string;
  confidence: number;
  responseTimeMs?: number;
}

interface ScenarioAnswerState {
  rankedOptions: string[];
  responseTimeMs?: number;
}

interface PersistedState {
  profile: ProfilePayload;
  likertAnswers: Record<string, LikertAnswerState>;
  forcedAnswers: Record<string, ForcedAnswerState>;
  scenarioAnswers: Record<string, ScenarioAnswerState>;
  notes: string;
  step: StepId;
}

const STORAGE_KEY = 'major-diagnosis-beta-v1';
const DEFAULT_PROFILE: ProfilePayload = {
  nickname: '',
  grade: '',
  track: '',
  email: '',
};

function App() {
  const [questionBank, setQuestionBank] = useState<QuestionBank | null>(null);
  const [careerMap, setCareerMap] = useState<Record<string, string[]> | null>(null);
  const [categoryDetails, setCategoryDetails] = useState<Record<string, { description: string; fitReason: string; courses: string[] }> | null>(null);
  const [aptitudeDetails, setAptitudeDetails] = useState<AptitudeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);

  const [step, setStep] = useState<StepId>('profile');
  const [profile, setProfile] = useState<ProfilePayload>(DEFAULT_PROFILE);
  const [notes, setNotes] = useState('');

  const [likertAnswers, setLikertAnswers] = useState<Record<string, LikertAnswerState>>({});
  const [forcedAnswers, setForcedAnswers] = useState<Record<string, ForcedAnswerState>>({});
  const [scenarioAnswers, setScenarioAnswers] = useState<Record<string, ScenarioAnswerState>>({});

  const [currentLikertId, setCurrentLikertId] = useState<string | null>(null);
  const likertStartRef = useRef<number | null>(null);

  const [forcedIndex, setForcedIndex] = useState(0);
  const forcedStartRef = useRef<number | null>(null);

  const [scenarioIndex, setScenarioIndex] = useState(0);
  const scenarioStartRef = useRef<number | null>(null);

  const [submissionState, setSubmissionState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const pendingPersisted = useRef<PersistedState | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedState;
        pendingPersisted.current = parsed;
        setProfile(parsed.profile);
        setNotes(parsed.notes);
        setStep(parsed.step);
      }
    } catch (err) {
      console.error('Failed to load draft', err);
    }
  }, []);

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        setLoading(true);
        const [bank, careers, details, aptitudes] = await Promise.all([
          fetchQuestionBank(),
          fetchCareerMap(),
          fetchCategoryDetails(),
          fetchAptitudeDetails(),
        ]);
        if (!active) return;
        setQuestionBank(bank);
        setCareerMap(careers);
        setCategoryDetails(details);
        setAptitudeDetails(aptitudes);
        if (pendingPersisted.current) {
          const persisted = pendingPersisted.current;
          setLikertAnswers(persisted.likertAnswers);
          setForcedAnswers(persisted.forcedAnswers);
          setScenarioAnswers(persisted.scenarioAnswers);
          pendingPersisted.current = null;
        }
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'データの読み込みに失敗しました');
      } finally {
        if (active) setLoading(false);
      }
    })()
    return () => {
      active = false
    }
  }, []);


  const likertValueMap = useMemo(() => {
    const map: Record<string, { value: number }> = {};
    Object.entries(likertAnswers).forEach(([id, answer]) => {
      map[id] = { value: answer.value };
    });
    return map;
  }, [likertAnswers]);

  const likertStats = useMemo(() => {
    if (!questionBank) return new Map();
    return recomputeAxisStats(questionBank.likert, likertValueMap);
  }, [questionBank, likertValueMap]);

  const requiredLikertCount = useMemo(
    () => questionBank?.likert.filter((q) => q.required).length ?? 0,
    [questionBank],
  );

  const requiredLikertAnswered = useMemo(() => {
    if (!questionBank) return 0;
    const requiredIds = new Set(questionBank.likert.filter((q) => q.required).map((q) => q.id));
    return Object.keys(likertAnswers).filter((id) => requiredIds.has(id)).length;
  }, [questionBank, likertAnswers]);

  const likertComplete =
    questionBank != null && requiredLikertAnswered >= requiredLikertCount;

  useEffect(() => {
    if (!questionBank || step !== 'likert') {
      return;
    }
    if (!currentLikertId) {
      const needRequired = requiredLikertAnswered < requiredLikertCount;
      const next = pickNextLikertQuestion(
        questionBank.likert,
        likertValueMap,
        likertStats,
        needRequired,
      );
      if (next) {
        setCurrentLikertId(next.id);
        likertStartRef.current = performance.now();
      } else if (likertComplete) {
        setStep('forced-choice');
      }
    }
  }, [
    questionBank,
    currentLikertId,
    likertStats,
    likertValueMap,
    step,
    requiredLikertAnswered,
    requiredLikertCount,
    likertComplete,
  ]);

  useEffect(() => {
    const payload: PersistedState = {
      profile,
      likertAnswers,
      forcedAnswers,
      scenarioAnswers,
      notes,
      step,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setLastSaved(new Date());
  }, [profile, likertAnswers, forcedAnswers, scenarioAnswers, notes, step]);

  const currentLikertQuestion = useMemo<LikertQuestion | null>(() => {
    if (!questionBank || !currentLikertId) return null;
    return questionBank.likert.find((q) => q.id === currentLikertId) ?? null;
  }, [questionBank, currentLikertId]);

  const forcedOrder = questionBank?.forcedChoice ?? [];
  const currentForcedQuestion: ForcedChoiceQuestion | undefined = forcedOrder[forcedIndex];
  const scenarioOrder = questionBank?.scenario ?? [];
  const currentScenarioQuestion: ScenarioQuestion | undefined = scenarioOrder[scenarioIndex];

  const axisAverage = useMemo(() => computeAxisAverage(likertStats), [likertStats]);

  const categoryScore = useMemo(() => {
    const scores = new Map<string, number>();

    const addScore = (key: string, value: number) => {
      scores.set(key, (scores.get(key) ?? 0) + value);
    };

    if (questionBank) {
      Object.entries(likertAnswers).forEach(([id, answer]) => {
        const question = questionBank.likert.find((q) => q.id === id);
        if (!question) return;
        const normalized = question.polarity === 'reverse' ? 8 - answer.value : answer.value;
        addScore(question.primaryCategory, normalized);
        question.relatedCategories?.forEach((rel) => {
          addScore(rel.category, normalized * rel.weight);
        });
      });

      Object.entries(forcedAnswers).forEach(([id, answer]) => {
        if (answer.optionKey === 'SKIP') return;
        const [questionId] = id.split('|');
        const question = questionBank.forcedChoice.find((q) => q.id === questionId);
        if (!question) return;
        const option = question.options.find((o) => o.key === answer.optionKey);
        if (!option) return;
        addScore(option.primary.category, option.primary.score * option.primary.weight * answer.confidence);
        option.secondary?.forEach((sec) => {
          addScore(sec.category, sec.score * sec.weight * answer.confidence);
        });
      });

      Object.entries(scenarioAnswers).forEach(([id, answer]) => {
        const question = questionBank.scenario.find((q) => q.id === id);
        if (!question) return;
        const weights = [1.0, 0.5, 0.25];
        answer.rankedOptions.forEach((optionKey, index) => {
          const option = question.options.find((o) => o.key === optionKey);
          if (!option) return;
          const rankWeight = weights[index];
          addScore(option.primary.category, option.primary.score * option.primary.weight * rankWeight);
          option.secondary?.forEach((sec) => {
            addScore(sec.category, sec.score * sec.weight * rankWeight);
          });
        });
      });
    }

    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1]);
  }, [questionBank, likertAnswers, forcedAnswers, scenarioAnswers]);

  const aptitudeScores = useMemo(() => {
    const scores = new Map<string, number>();
    const addScore = (key: string, value: number) => {
      scores.set(key, (scores.get(key) ?? 0) + value);
    };

    if (questionBank) {
      Object.entries(likertAnswers).forEach(([id, answer]) => {
        const question = questionBank.likert.find((q) => q.id === id);
        if (!question) return;
        if (question.axis === 'activity' || question.axis === 'learning_style') {
          const normalized = question.polarity === 'reverse' ? 8 - answer.value : answer.value;
          addScore(question.primaryCategory, normalized);
        }
        question.relatedCategories?.forEach((rel) => {
          if (rel.axis === 'activity' || rel.axis === 'learning_style') {
            const normalized = question.polarity === 'reverse' ? 8 - answer.value : answer.value;
            addScore(rel.category, normalized * rel.weight);
          }
        });
      });

      Object.entries(forcedAnswers).forEach(([id, answer]) => {
        if (answer.optionKey === 'SKIP') return;
        const [questionId] = id.split('|');
        const question = questionBank.forcedChoice.find((q) => q.id === questionId);
        if (!question) return;
        const option = question.options.find((o) => o.key === answer.optionKey);
        if (!option) return;
        if (option.primary.axis === 'activity' || option.primary.axis === 'learning_style') {
          addScore(option.primary.category, option.primary.score * option.primary.weight * answer.confidence);
        }
        option.secondary?.forEach((sec) => {
          if (sec.axis === 'activity' || sec.axis === 'learning_style') {
            addScore(sec.category, sec.score * sec.weight * answer.confidence);
          }
        });
      });

      Object.entries(scenarioAnswers).forEach(([id, answer]) => {
        const question = questionBank.scenario.find((q) => q.id === id);
        if (!question) return;
        const weights = [1.0, 0.5, 0.25];
        answer.rankedOptions.forEach((optionKey, index) => {
          const option = question.options.find((o) => o.key === optionKey);
          if (!option) return;
          const rankWeight = weights[index];
          if (option.primary.axis === 'activity' || option.primary.axis === 'learning_style') {
            addScore(option.primary.category, option.primary.score * option.primary.weight * rankWeight);
          }
          option.secondary?.forEach((sec) => {
            if (sec.axis === 'activity' || sec.axis === 'learning_style') {
              addScore(sec.category, sec.score * sec.weight * rankWeight);
            }
          });
        });
      });
    }

    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1]);
  }, [questionBank, likertAnswers, forcedAnswers, scenarioAnswers]);

  const topAptitudeKeys = useMemo(
    () => aptitudeScores.slice(0, 3).map(([name]) => name),
    [aptitudeScores],
  );

  useEffect(() => {
    if (step !== 'result') {
      setRecommendations([]);
      setRecommendationError(null);
      setRecommendationsLoading(false);
      return;
    }

    if (topAptitudeKeys.length === 0) {
      setRecommendations([]);
      setRecommendationError(null);
      setRecommendationsLoading(false);
      return;
    }

    let active = true;
    setRecommendationsLoading(true);
    fetchRecommendations(topAptitudeKeys)
      .then((items) => {
        if (!active) return;
        setRecommendations(items);
        setRecommendationError(null);
      })
      .catch((err) => {
        if (!active) return;
        setRecommendations([]);
        setRecommendationError(
          err instanceof Error ? err.message : '進路候補の取得に失敗しました。',
        );
      })
      .finally(() => {
        if (!active) return;
        setRecommendationsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [step, topAptitudeKeys]);

  const tagScores = useMemo(() => {
    const scores = new Map<string, { score: number; questions: string[] }>();

    const addScore = (key: string, value: number, questionId: string) => {
      if (!scores.has(key)) {
        scores.set(key, { score: 0, questions: [] });
      }
      const entry = scores.get(key)!;
      entry.score += value;
      if (!entry.questions.includes(questionId)) {
        entry.questions.push(questionId);
      }
    };

    if (questionBank) {
      Object.entries(likertAnswers).forEach(([id, answer]) => {
        const question = questionBank.likert.find((q) => q.id === id);
        if (!question) return;
        const normalized = question.polarity === 'reverse' ? 8 - answer.value : answer.value;
        question.tags?.forEach(tag => addScore(tag.name, normalized * tag.weight, id));
      });

      Object.entries(forcedAnswers).forEach(([id, answer]) => {
        if (answer.optionKey === 'SKIP') return;
        const [questionId] = id.split('|');
        const question = questionBank.forcedChoice.find((q) => q.id === questionId);
        if (!question) return;
        const option = question.options.find((o) => o.key === answer.optionKey);
        if (!option) return;
        option.tags?.forEach(tag => addScore(tag.name, option.primary.score * option.primary.weight * answer.confidence * tag.weight, questionId));
      });

      Object.entries(scenarioAnswers).forEach(([id, answer]) => {
        const question = questionBank.scenario.find((q) => q.id === id);
        if (!question) return;
        const weights = [1.0, 0.5, 0.25];
        answer.rankedOptions.forEach((optionKey, index) => {
          const option = question.options.find((o) => o.key === optionKey);
          if (!option) return;
          const rankWeight = weights[index];
          option.tags?.forEach(tag => addScore(tag.name, option.primary.score * option.primary.weight * rankWeight * tag.weight, id));
        });
      });
    }

    return Array.from(scores.entries())
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 10);
  }, [questionBank, likertAnswers, forcedAnswers, scenarioAnswers]);

  const cooccurrenceData = useMemo(() => {
    if (!questionBank || categoryScore.length === 0) {
      return [];
    }

    const topCategories = categoryScore.map(([category]) => category);
    const matrix: Record<string, Record<string, number>> = {};

    const increment = (cat1: string, cat2: string) => {
      if (topCategories.includes(cat1) && topCategories.includes(cat2) && cat1 !== cat2) {
        const key1 = cat1 < cat2 ? cat1 : cat2;
        const key2 = cat1 < cat2 ? cat2 : cat1;
        if (!matrix[key1]) {
          matrix[key1] = {};
        }
        if (!matrix[key1][key2]) {
          matrix[key1][key2] = 0;
        }
        matrix[key1][key2]++;
      }
    };

    questionBank.likert.forEach((q) => {
      const categories = [q.primaryCategory, ...(q.relatedCategories?.map(rc => rc.category) ?? [])];
      for (let i = 0; i < categories.length; i++) {
        for (let j = i + 1; j < categories.length; j++) {
          increment(categories[i], categories[j]);
        }
      }
    });

    questionBank.forcedChoice.forEach((q) => {
      q.options.forEach(o => {
        const categories = [o.primary.category, ...(o.secondary?.map(s => s.category) ?? [])];
        for (let i = 0; i < categories.length; i++) {
          for (let j = i + 1; j < categories.length; j++) {
            increment(categories[i], categories[j]);
          }
        }
      });
    });

    questionBank.scenario.forEach((q) => {
      q.options.forEach(o => {
        const categories = [o.primary.category, ...(o.secondary?.map(s => s.category) ?? [])];
        for (let i = 0; i < categories.length; i++) {
          for (let j = i + 1; j < categories.length; j++) {
            increment(categories[i], categories[j]);
          }
        }
      });
    });

    const data: { x: string; y: string; z: number }[] = [];
    for (const cat1 in matrix) {
      for (const cat2 in matrix[cat1]) {
        data.push({ x: cat1, y: cat2, z: matrix[cat1][cat2] });
      }
    }

    return data;
  }, [questionBank, categoryScore]);

  const handleProfileChange = <K extends keyof ProfilePayload>(key: K, value: ProfilePayload[K]) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  const handleLikertAnswer = (value: number) => {
    if (!questionBank || !currentLikertQuestion) return;

    const timeMs = likertStartRef.current ? performance.now() - likertStartRef.current : undefined;
    const nextAnswers: Record<string, LikertAnswerState> = {
      ...likertAnswers,
      [currentLikertQuestion.id]: { value, responseTimeMs: timeMs },
    };
    setLikertAnswers(nextAnswers);

    const valueMap: Record<string, { value: number }> = {};
    Object.entries(nextAnswers).forEach(([id, answer]) => {
      valueMap[id] = { value: answer.value };
    });
    const nextStats = recomputeAxisStats(questionBank.likert, valueMap);
    const requiredAnswered =
      Object.entries(nextAnswers).filter(([id]) => {
        const q = questionBank.likert.find((item) => item.id === id);
        return q?.required;
      }).length;
    const needRequired = requiredAnswered < requiredLikertCount;
    const nextQuestion = pickNextLikertQuestion(
      questionBank.likert,
      valueMap,
      nextStats,
      needRequired,
    );

    if (nextQuestion) {
      setCurrentLikertId(nextQuestion.id);
      likertStartRef.current = performance.now();
    } else {
      setCurrentLikertId(null);
      likertStartRef.current = null;
      setStep('forced-choice');
      forcedStartRef.current = performance.now();
    }
  };

  const handleForcedAnswer = (question: ForcedChoiceQuestion, optionKey: string, confidence: number) => {
    const key = `${question.id}|${optionKey}`;
    const timeMs = forcedStartRef.current ? performance.now() - forcedStartRef.current : undefined;
    setForcedAnswers((prev) => ({
      ...prev,
      [key]: { optionKey, confidence, responseTimeMs: timeMs },
    }));
  };

  const handleForcedSkip = (question: ForcedChoiceQuestion) => {
    const key = `${question.id}|SKIP`;
    const timeMs = forcedStartRef.current ? performance.now() - forcedStartRef.current : undefined;
    setForcedAnswers((prev) => ({
      ...prev,
      [key]: { optionKey: 'SKIP', confidence: 0, responseTimeMs: timeMs },
    }));
    proceedForced();
  }

  const proceedForced = () => {
    const nextIndex = forcedIndex + 1;
    if (nextIndex >= forcedOrder.length) {
      setStep('scenario');
      scenarioStartRef.current = performance.now();
    } else {
      setForcedIndex(nextIndex);
      forcedStartRef.current = performance.now();
    }
  };

  const handleScenarioAnswer = (question: ScenarioQuestion, rankedOptions: string[]) => {
    const timeMs = scenarioStartRef.current ? performance.now() - scenarioStartRef.current : undefined;
    setScenarioAnswers((prev) => ({
      ...prev,
      [question.id]: { rankedOptions, responseTimeMs: timeMs },
    }));
  };

  const proceedScenario = () => {
    const nextIndex = scenarioIndex + 1;
    if (nextIndex >= scenarioOrder.length) {
      setStep('result');
    } else {
      setScenarioIndex(nextIndex);
      scenarioStartRef.current = performance.now();
    }
  };

  const resetAll = () => {
    setProfile(DEFAULT_PROFILE);
    setNotes('');
    setLikertAnswers({});
    setForcedAnswers({});
    setScenarioAnswers({});
    setStep('profile');
    setCurrentLikertId(null);
    setForcedIndex(0);
    setScenarioIndex(0);
    likertStartRef.current = null;
    forcedStartRef.current = null;
    scenarioStartRef.current = null;
    localStorage.removeItem(STORAGE_KEY);
  };

  const exportSnapshot = () => {
    const payload = {
      profile,
      likertAnswers,
      forcedAnswers,
      scenarioAnswers,
      axisAverage,
      notes,
      generatedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `diagnosis-result-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async () => {
    if (!questionBank) return;
    setSubmissionState('saving');
    setSubmissionError(null);
    try {
      const payload: ResponsePayload = {
        profile,
        likert: Object.entries(likertAnswers).map(([id, answer]) => ({
          id,
          value: answer.value,
          responseTimeMs: answer.responseTimeMs,
        })),
        forcedChoice: Object.entries(forcedAnswers).map(([id, answer]) => {
          const [questionId] = id.split('|');
          return {
            id: questionId,
            optionKey: answer.optionKey,
            confidence: answer.confidence,
            responseTimeMs: answer.responseTimeMs,
          };
        }),
        scenario: Object.entries(scenarioAnswers).map(([id, answer]) => ({
          id,
          optionKey: answer.optionKey,
          responseTimeMs: answer.responseTimeMs,
        })),
        axisAverage,
        notes,
      };

      await submitResponses(payload);
      setSubmissionState('saved');
    } catch (err) {
      setSubmissionState('error');
      setSubmissionError(err instanceof Error ? err.message : '送信に失敗しました');
    }
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ textAlign: 'center', mt: 8 }}>
        <Card>
          <CardContent>
            <Typography variant="h6">設問を準備しています...</Typography>
            <LinearProgress sx={{ mt: 2 }} />
          </CardContent>
        </Card>
      </Container>
    );
  }

  if (error || !questionBank) {
    return (
      <Container maxWidth="sm" sx={{ textAlign: 'center', mt: 8 }}>
        <Card>
          <CardContent>
            <Typography variant="h5" color="error">読み込みエラー</Typography>
            <Typography sx={{ mt: 2 }}>{error ?? '設問データを取得できませんでした。'}</Typography>
            <Button variant="contained" onClick={() => window.location.reload()} sx={{ mt: 3 }}>
              再読み込み
            </Button>
          </CardContent>
        </Card>
      </Container>
    );
  }

  const steps: { key: StepId; label: string; icon: React.ReactNode }[] = [
    { key: 'profile', label: 'プロフィール', icon: <AccountCircle /> },
    { key: 'likert', label: 'Likert設問', icon: <Psychology /> },
    { key: 'forced-choice', label: '二択＋自信度', icon: <CompareArrows /> },
    { key: 'scenario', label: 'シナリオ', icon: <Movie /> },
    { key: 'result', label: '結果', icon: <BarChart /> },
  ];

  const activeStepIndex = steps.findIndex(s => s.key === step);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header onExport={exportSnapshot} onReset={resetAll} lastSaved={lastSaved} />

      <Container component="main" maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <QuestionStepper activeStep={activeStepIndex} steps={steps} />

        {step === 'profile' && (
          <Fade in={step === 'profile'}>
            <div>
              <ProfileStep
                profile={profile}
                onProfileChange={handleProfileChange}
                onProceed={() => {
                  setStep('likert');
                  likertStartRef.current = performance.now();
                }}
                onResume={() => setStep(pendingPersisted.current?.step ?? 'likert')}
                hasSavedData={pendingPersisted.current !== null}
              />
            </div>
          </Fade>
        )}

        {step === 'likert' && currentLikertQuestion && (
          <Fade in={step === 'likert'}>
            <div>
              <LikertStep
                question={currentLikertQuestion}
                currentAnswer={likertAnswers[currentLikertId]?.value}
                requiredLikertAnswered={requiredLikertAnswered}
                requiredLikertCount={requiredLikertCount}
                totalLikertQuestions={questionBank.likert.length}
                onAnswer={handleLikertAnswer}
              />
            </div>
          </Fade>
        )}

        {step === 'forced-choice' && currentForcedQuestion && (
          <Fade in={step === 'forced-choice'}>
            <div>
              <ForcedChoiceStep
                question={currentForcedQuestion}
                forcedAnswers={forcedAnswers}
                forcedIndex={forcedIndex}
                forcedOrderLength={forcedOrder.length}
                onAnswer={handleForcedAnswer}
                onProceed={proceedForced}
                onSkip={handleForcedSkip}
              />
            </div>
          </Fade>
        )}

        {step === 'scenario' && currentScenarioQuestion && (
          <Fade in={step === 'scenario'}>
            <div>
              <ScenarioStep
                question={currentScenarioQuestion}
                scenarioAnswers={scenarioAnswers}
                scenarioIndex={scenarioIndex}
                scenarioOrderLength={scenarioOrder.length}
                onAnswer={handleScenarioAnswer}
                onProceed={proceedScenario}
              />
            </div>
          </Fade>
        )}

        {step === 'result' && (
          <Fade in={step === 'result'}>
            <div>
              <ResultStep
                axisAverage={axisAverage}
                categoryScore={categoryScore}
                aptitudeScores={aptitudeScores}
                cooccurrenceData={cooccurrenceData}
                careerMap={careerMap}
                categoryDetails={categoryDetails}
                aptitudeDetails={aptitudeDetails}
                recommendations={recommendations}
                recommendationsLoading={recommendationsLoading}
                recommendationError={recommendationError}
                tagScores={tagScores}
                questionBank={questionBank}
                notes={notes}
                onNotesChange={setNotes}
                onSubmit={handleSubmit}
                onReset={() => setStep('profile')}
                submissionState={submissionState}
                submissionError={submissionError}
              />
            </div>
          </Fade>
        )}
      </Container>
    </Box>
  );
}

export default App;




