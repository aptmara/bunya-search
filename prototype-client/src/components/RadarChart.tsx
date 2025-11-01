import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

interface RadarChartProps {
  data: { axis: string; value: number }[];
}

const CustomRadarChart: React.FC<RadarChartProps> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="axis" />
        <PolarRadiusAxis />
        <Radar name="Score" dataKey="value" stroke="#1d4ed8" fill="#38bdf8" fillOpacity={0.6} />
      </RadarChart>
    </ResponsiveContainer>
  );
};

export default CustomRadarChart;
