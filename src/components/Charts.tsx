import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PigletReading } from '@/types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine
} from 'recharts';
import { Activity, Wind } from 'lucide-react';

interface ChartsProps {
  readings: PigletReading[];
}

export const Charts = ({ readings }: ChartsProps) => {
  const chartData = readings.map(reading => ({
    time: new Date(reading.created_at).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    }),
    temperature: Number(reading.core_temperature),
    ammonia: Number(reading.ammonia_ppm)
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-500" />
            Core Temperature Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="time"
                className="text-xs"
                stroke="currentColor"
              />
              <YAxis
                domain={[36, 42]}
                className="text-xs"
                stroke="currentColor"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Legend />
              <ReferenceLine
                y={38.7}
                stroke="green"
                strokeDasharray="5 5"
                label={{ value: 'Min Optimal', position: 'right', fill: 'green' }}
              />
              <ReferenceLine
                y={39.8}
                stroke="green"
                strokeDasharray="5 5"
                label={{ value: 'Max Optimal', position: 'right', fill: 'green' }}
              />
              <ReferenceLine
                y={40}
                stroke="red"
                strokeDasharray="5 5"
                label={{ value: 'Critical', position: 'right', fill: 'red' }}
              />
              <Line
                type="monotone"
                dataKey="temperature"
                stroke="#ef4444"
                strokeWidth={3}
                dot={{ fill: '#ef4444', r: 4 }}
                activeDot={{ r: 6 }}
                name="Core Temp (°C)"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wind className="w-5 h-5 text-orange-500" />
            Ammonia Level Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="time"
                className="text-xs"
                stroke="currentColor"
              />
              <YAxis
                domain={[0, 30]}
                className="text-xs"
                stroke="currentColor"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Legend />
              <ReferenceLine
                y={10}
                stroke="green"
                strokeDasharray="5 5"
                label={{ value: 'Ideal Limit', position: 'right', fill: 'green' }}
              />
              <ReferenceLine
                y={11}
                stroke="orange"
                strokeDasharray="5 5"
                label={{ value: 'Pump Auto ON', position: 'right', fill: 'orange' }}
              />
              <ReferenceLine
                y={25}
                stroke="red"
                strokeDasharray="5 5"
                label={{ value: 'Hazardous', position: 'right', fill: 'red' }}
              />
              <Line
                type="monotone"
                dataKey="ammonia"
                stroke="#f97316"
                strokeWidth={3}
                dot={{ fill: '#f97316', r: 4 }}
                activeDot={{ r: 6 }}
                name="Ammonia (ppm)"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
