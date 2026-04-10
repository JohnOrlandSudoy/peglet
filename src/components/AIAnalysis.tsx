import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Sparkles, Loader as Loader2, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, CircleAlert as AlertCircle } from 'lucide-react';
import { PigletReading } from '@/types';
import { analyzeWithGemini, GeminiAnalysis } from '@/lib/gemini';
import { PIGLET_THRESHOLDS } from '@/lib/thresholds';

interface AIAnalysisProps {
  reading: PigletReading | null;
}

export const AIAnalysis = ({ reading }: AIAnalysisProps) => {
  const [analysis, setAnalysis] = useState<GeminiAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!reading) return;

    setIsLoading(true);
    try {
      const result = await analyzeWithGemini(reading, PIGLET_THRESHOLDS);
      setAnalysis(result);
    } catch (error) {
      console.error('Error analyzing with Gemini:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getUrgencyIcon = (level: GeminiAnalysis['urgencyLevel']) => {
    switch (level) {
      case 'high':
        return <AlertTriangle className="w-4 h-4" />;
      case 'medium':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <CheckCircle2 className="w-4 h-4" />;
    }
  };

  const getUrgencyVariant = (level: GeminiAnalysis['urgencyLevel']): BadgeProps['variant'] => {
    switch (level) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      default:
        return 'secondary';
    }
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            AI Health Analysis
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Button
          onClick={handleAnalyze}
          disabled={!reading || isLoading}
          size="lg"
          className="w-full mb-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Analyzing with Gemini AI...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 mr-2" />
              Analyze with Gemini AI
            </>
          )}
        </Button>

        {!analysis && !isLoading && (
          <div className="text-center py-12 text-muted-foreground">
            <Sparkles className="w-16 h-16 mx-auto mb-4 text-purple-500/50" />
            <p className="text-lg font-medium mb-2">AI-Powered Health Insights</p>
            <p className="text-sm">
              Get actionable recommendations based on the latest readings and thesis thresholds
            </p>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-12">
            <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin text-purple-500" />
            <p className="text-lg font-medium">Analyzing piglet health data...</p>
            <p className="text-sm text-muted-foreground mt-2">
              Gemini AI is processing the readings
            </p>
          </div>
        )}

        {analysis && !isLoading && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Badge
                variant={getUrgencyVariant(analysis.urgencyLevel)}
                className="flex items-center gap-1"
              >
                {getUrgencyIcon(analysis.urgencyLevel)}
                {analysis.urgencyLevel.toUpperCase()} PRIORITY
              </Badge>
            </div>

            <div className="space-y-3">
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Analysis
                </h4>
                <p className="text-sm leading-relaxed text-muted-foreground bg-muted/50 p-4 rounded-lg">
                  {analysis.analysis}
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Recommendations
                </h4>
                <ul className="space-y-2">
                  {analysis.recommendations.map((rec, index) => (
                    <li
                      key={index}
                      className="text-sm flex items-start gap-2 bg-muted/30 p-3 rounded-lg"
                    >
                      <span className="text-purple-500 font-bold mt-0.5">•</span>
                      <span className="text-muted-foreground">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <Button
              onClick={handleAnalyze}
              variant="outline"
              size="sm"
              className="w-full"
            >
              Refresh Analysis
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
