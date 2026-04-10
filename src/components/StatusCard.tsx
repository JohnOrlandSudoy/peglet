import { MetricStatus } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatusCardProps {
  title: string;
  icon: React.ReactNode;
  status: MetricStatus;
  unit: string;
  trend?: 'up' | 'down' | 'stable';
}

export const StatusCard = ({ title, icon, status, unit, trend }: StatusCardProps) => {
  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  return (
    <Card className="border-2 hover:shadow-lg transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${status.bgColor}`}>
              {icon}
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">{title}</p>
            </div>
          </div>
          {trend && (
            <div className={`flex items-center gap-1 ${status.color}`}>
              {getTrendIcon()}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-baseline gap-2">
            <span className={`text-5xl font-bold ${status.color}`}>
              {status.value.toFixed(1)}
            </span>
            <span className="text-2xl text-muted-foreground">{unit}</span>
          </div>

          <Badge
            variant={status.level === 'critical' ? 'destructive' : 'outline'}
            className={`${status.bgColor} ${status.textColor} border-none font-semibold`}
          >
            {status.label}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};
