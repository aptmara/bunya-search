import React, { useMemo } from "react";
import Grid from "@mui/material/Grid";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  LinearProgress,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CustomRadarChart from "./RadarChart";
import Heatmap from "./Heatmap";
import CustomBarChart from "./BarChart";
import TagDetails from "./TagDetails";
import * as types from "../types";

interface ResultStepProps {
  axisAverage: Record<string, number>;
  categoryScore: [string, number][];
  aptitudeScores: [string, number][];
  cooccurrenceData: { x: string; y: string; z: number }[];
  careerMap: Record<string, string[]> | null;
  categoryDetails: Record<string, { description: string; fitReason: string; courses: string[] }> | null;
  aptitudeDetails: types.AptitudeDetails | null;
  recommendations: types.RecommendationItem[];
  recommendationsLoading: boolean;
  recommendationError: string | null;
  tagScores: [string, { score: number; questions: string[] }][];
  questionBank: types.QuestionBank | null;
  notes: string;
  onNotesChange: (notes: string) => void;
  onSubmit: () => void;
  onReset: () => void;
  submissionState: "idle" | "saving" | "saved" | "error";
  submissionError: string | null;
}

const ResultStep: React.FC<ResultStepProps> = ({
  axisAverage,
  categoryScore,
  aptitudeScores,
  cooccurrenceData,
  careerMap,
  categoryDetails,
  aptitudeDetails,
  recommendations,
  recommendationsLoading,
  recommendationError,
  tagScores,
  questionBank,
  notes,
  onNotesChange,
  onSubmit,
  onReset,
  submissionState,
  submissionError,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const radarChartData = useMemo(
    () => Object.entries(axisAverage).map(([axis, value]) => ({ axis, value })),
    [axisAverage],
  );
  const topCategories = useMemo(() => categoryScore.slice(0, 3).map(([category]) => category), [categoryScore]);
  const topAptitudes = useMemo(() => aptitudeScores.slice(0, 3).map(([aptitude]) => aptitude), [aptitudeScores]);
  const bottomCategories = useMemo(() => categoryScore.slice(-5).map(([category]) => category), [categoryScore]);
  const barChartData = useMemo(
    () => categoryScore.map(([name, score]) => ({ name, score })),
    [categoryScore],
  );
  const recommendationMap = useMemo(
    () => new Map(recommendations.map((item) => [item.aptitude, item])),
    [recommendations],
  );

  const renderResourceChips = (resources: types.ExternalResource[] | undefined, label: string) => {
    if (!resources || resources.length === 0) {
      return null;
    }

    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" color="text.secondary">
          {label}
        </Typography>
        <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap" }}>
          {resources.map((resource) => (
            <Chip
              key={`${label}-${resource.title}-${resource.url}`}
              label={resource.title}
              component="a"
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              clickable
              size="small"
              variant="outlined"
            />
          ))}
        </Box>
      </Box>
    );
  };

  const Section: React.FC<{
    title: string;
    defaultExpanded?: boolean;
    children: React.ReactNode;
  }> = ({ title, defaultExpanded = false, children }) => {
    if (isMobile) {
      return (
        <Accordion defaultExpanded={defaultExpanded} disableGutters sx={{ bgcolor: "background.paper" }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">{title}</Typography>
          </AccordionSummary>
          <AccordionDetails>{children}</AccordionDetails>
        </Accordion>
      );
    }

    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6">{title}</Typography>
        <Box sx={{ mt: 2 }}>{children}</Box>
      </Box>
    );
  };

  return (
    <Card>
      <CardHeader title="結果サマリー" />
      <CardContent>
        <Typography sx={{ mb: 2 }}>
          診断結果はこの端末に保存されています。必要に応じてデータをエクスポートし、送信ボタンからサーバーに提出できます。
        </Typography>

        <Grid container spacing={4}>
          <Grid size={12}>
            <Section title="あなたにマッチするキーワード" defaultExpanded>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                {topCategories.map((category) => (
                  <Chip key={category} label={category} color="primary" />
                ))}
              </Box>
            </Section>
          </Grid>

          <Grid size={12}>
            <Section title="得意な資質とおすすめアクション" defaultExpanded>
              {recommendationsLoading && (
                <Box sx={{ mb: 2 }}>
                  <LinearProgress />
                </Box>
              )}
              {recommendationError && (
                <Typography variant="body2" color="error" sx={{ mb: 2 }}>
                  {recommendationError}
                </Typography>
              )}
              {topAptitudes.map((aptitude) => {
                const detail = aptitudeDetails?.[aptitude];
                const suggestion = recommendationMap.get(aptitude);
                return (
                  <Box
                    key={aptitude}
                    sx={{
                      mt: 2,
                      pb: 2,
                      borderBottom: "1px solid",
                      borderColor: "divider",
                      "&:first-of-type": { mt: 0 },
                      "&:last-of-type": { borderBottom: "none", pb: 0 },
                    }}
                  >
                    <Typography variant="h5" component="div">
                      {aptitude}
                    </Typography>
                    {detail && (
                      <>
                        <Typography variant="body1" sx={{ mt: 1 }}>
                          {detail.description}
                        </Typography>
                        <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap" }}>
                          <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
                            関連領域:
                          </Typography>
                          {detail.related_fields.map((field) => (
                            <Chip key={`${aptitude}-field-${field}`} label={field} size="small" variant="outlined" />
                          ))}
                        </Box>
                        {renderResourceChips(detail.learningContents, "学習コンテンツ")}
                        {renderResourceChips(detail.experienceEvents, "体験イベント")}
                      </>
                    )}
                    {suggestion && (
                      <>
                        {suggestion.majors.length > 0 && (
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2" color="text.secondary">
                              おすすめ学部・学科
                            </Typography>
                            <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap" }}>
                              {suggestion.majors.map((major) => (
                                <Chip key={`${aptitude}-major-${major}`} label={major} color="primary" size="small" />
                              ))}
                            </Box>
                          </Box>
                        )}
                        {suggestion.certifications.length > 0 && (
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2" color="text.secondary">
                              取得を目指したい資格
                            </Typography>
                            <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap" }}>
                              {suggestion.certifications.map((cert) => (
                                <Chip
                                  key={`${aptitude}-cert-${cert}`}
                                  label={cert}
                                  size="small"
                                  variant="outlined"
                                />
                              ))}
                            </Box>
                          </Box>
                        )}
                        {suggestion.activities.length > 0 && (
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2" color="text.secondary">
                              推薦に活かせる課外活動・コンテスト
                            </Typography>
                            <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap" }}>
                              {suggestion.activities.map((activity) => (
                                <Chip
                                  key={`${aptitude}-activity-${activity}`}
                                  label={activity}
                                  size="small"
                                  color="secondary"
                                />
                              ))}
                            </Box>
                          </Box>
                        )}
                      </>
                    )}
                  </Box>
                );
              })}
            </Section>
          </Grid>

          <Grid size={12}>
            <Section title="興味領域のストーリー" defaultExpanded={!isMobile}>
              {topCategories.map((category) => (
                <Box
                  key={category}
                  sx={{
                    mt: 2,
                    "&:first-of-type": { mt: 0 },
                  }}
                >
                  <Typography variant="h5" component="div">
                    {category}
                  </Typography>
                  {categoryDetails?.[category] && (
                    <>
                      <Typography variant="body1" sx={{ mt: 1 }}>
                        {categoryDetails[category].description}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
                        {categoryDetails[category].fitReason}
                      </Typography>
                      <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap" }}>
                        {categoryDetails[category].courses.map((course) => (
                          <Chip
                            key={`${category}-course-${course}`}
                            label={course}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </>
                  )}
                  {careerMap?.[category] && (
                    <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap" }}>
                      {careerMap[category].map((career) => (
                        <Chip key={`${category}-career-${career}`} label={career} size="small" />
                      ))}
                    </Box>
                  )}
                </Box>
              ))}
            </Section>
          </Grid>

          <Grid size={12}>
            <Section title="スコア可視化（レーダーチャート）" defaultExpanded={!isMobile}>
              <CustomRadarChart data={radarChartData} />
            </Section>
          </Grid>

          <Grid size={12}>
            <Section title="カテゴリ間のつながり（ヒートマップ）" defaultExpanded={!isMobile}>
              <Heatmap data={cooccurrenceData} />
            </Section>
          </Grid>

          <Grid size={12}>
            <Section title="タグ別の振り返り" defaultExpanded={!isMobile}>
              <TagDetails tagScores={tagScores} questionBank={questionBank} />
            </Section>
          </Grid>

          <Grid size={12}>
            <Section title="スコアランキング" defaultExpanded={!isMobile}>
              <CustomBarChart data={barChartData} />
            </Section>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Section title="さらに伸ばしたい領域" defaultExpanded={!isMobile}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                {bottomCategories.map((category) => (
                  <Typography key={category} variant="body2">
                    {category}
                  </Typography>
                ))}
              </Box>
            </Section>
          </Grid>
        </Grid>

        <Section title="メモと次のアクション" defaultExpanded>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="メモ（任意）"
            value={notes}
            placeholder="気づきや次のステップを書き留めておくと復習しやすくなります。"
            onChange={(e) => onNotesChange(e.target.value)}
            sx={{ mt: 1 }}
          />

          <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end", gap: 2 }}>
            <Button variant="outlined" onClick={onReset}>
              最初からやり直す
            </Button>
            <Button variant="contained" onClick={onSubmit} disabled={submissionState === "saving"}>
              {submissionState === "saving" ? "送信中…" : "結果を送信"}
            </Button>
          </Box>

          {submissionState === "saved" && (
            <Typography color="success.main" sx={{ mt: 2 }}>
              サーバーに保存しました。ご協力ありがとうございます！
            </Typography>
          )}
          {submissionState === "error" && (
            <Typography color="error" sx={{ mt: 2 }}>
              送信に失敗しました: {submissionError}
            </Typography>
          )}
        </Section>
      </CardContent>
    </Card>
  );
};

export default ResultStep;
