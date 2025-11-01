import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface HeatmapProps {
  data: { x: string; y: string; z: number }[];
}

const Heatmap: React.FC<HeatmapProps> = ({ data }) => {
  if (data.length === 0) {
    return null;
  }

  const xDomain = Array.from(new Set(data.map(d => d.x)));
  const yDomain = Array.from(new Set(data.map(d => d.y)));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <ScatterChart
        margin={{
          top: 20,
          right: 20,
          bottom: 20,
          left: 20,
        }}
      >
        <CartesianGrid />
        <XAxis type="category" dataKey="x" name="category" domain={xDomain} />
        <YAxis type="category" dataKey="y" name="category" domain={yDomain} />
        <ZAxis type="number" dataKey="z" name="co-occurrence" range={[100, 1000]} />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
        <Scatter name="Co-occurrence" data={data} fill="#1d4ed8" />
      </ScatterChart>
    </ResponsiveContainer>
  );
};

export default Heatmap;
