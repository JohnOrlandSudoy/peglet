import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PigletReading } from '@/types';
import { analyzeVisualWithGemini, type GeminiVisualAnalysis } from '@/lib/gemini';
import { Camera, Sparkles, Loader as Loader2, Activity, CircleAlert } from 'lucide-react';

type VisualMonitoringProps = {
  reading: PigletReading;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const VisualMonitoring = ({ reading }: VisualMonitoringProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastFrameRef = useRef<Uint8ClampedArray | null>(null);

  const [isStarting, setIsStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [snapshotDataUrl, setSnapshotDataUrl] = useState<string | null>(null);
  const [motionScore, setMotionScore] = useState<number>(0);
  const [analysis, setAnalysis] = useState<GeminiVisualAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const motionLabel = useMemo(() => {
    if (motionScore >= 40) return { label: 'High activity', variant: 'default' as const };
    if (motionScore >= 15) return { label: 'Moderate', variant: 'secondary' as const };
    return { label: 'Low activity', variant: 'outline' as const };
  }, [motionScore]);

  const stopCamera = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (isStarting) return;
    setIsStarting(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Camera permission denied');
      stopCamera();
    } finally {
      setIsStarting(false);
    }
  }, [isStarting, stopCamera]);

  const captureSnapshot = () => {
    const video = videoRef.current;
    if (!video) return;
    const w = Math.max(1, video.videoWidth);
    const h = Math.max(1, video.videoHeight);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const url = canvas.toDataURL('image/jpeg', 0.85);
    setSnapshotDataUrl(url);
    setAnalysis(null);
  };

  const tickMotion = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const canvas = document.createElement('canvas');
    const w = 96;
    const h = 54;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const current = imageData.data;
    const prev = lastFrameRef.current;
    if (!prev) {
      lastFrameRef.current = current;
      return;
    }
    let diffSum = 0;
    for (let i = 0; i < current.length; i += 4) {
      const r = current[i];
      const g = current[i + 1];
      const b = current[i + 2];
      const pr = prev[i];
      const pg = prev[i + 1];
      const pb = prev[i + 2];
      diffSum += Math.abs(r - pr) + Math.abs(g - pg) + Math.abs(b - pb);
    }
    lastFrameRef.current = current;
    const avg = diffSum / (w * h * 3);
    const score = clamp((avg / 18) * 100, 0, 100);
    setMotionScore((prevScore) => prevScore * 0.7 + score * 0.3);
  };

  const handleAnalyze = async () => {
    if (!snapshotDataUrl) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeVisualWithGemini({
        reading,
        snapshotDataUrl,
        motionScore
      });
      setAnalysis(result);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    void startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  useEffect(() => {
    const id = window.setInterval(() => tickMotion(), 700);
    return () => window.clearInterval(id);
  }, []);

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Visual Monitoring
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={motionLabel.variant} className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              {motionLabel.label}
            </Badge>
            <Badge variant="outline">{Math.round(motionScore)}%</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {cameraError ? (
          <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 p-4">
            <div className="flex items-start gap-3">
              <CircleAlert className="w-5 h-5 text-orange-500 mt-0.5" />
              <div>
                <p className="font-semibold text-orange-500">Camera error</p>
                <p className="text-sm text-muted-foreground mt-1">{cameraError}</p>
                <Button onClick={() => void startCamera()} className="mt-3" disabled={isStarting}>
                  {isStarting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    'Retry camera'
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg overflow-hidden border bg-muted/30">
            <video ref={videoRef} className="w-full aspect-video object-cover" playsInline muted />
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={captureSnapshot} disabled={!!cameraError}>
            Capture Snapshot
          </Button>
          <Button
            onClick={handleAnalyze}
            disabled={!snapshotDataUrl || isAnalyzing}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Analyze Snapshot (Gemini)
              </>
            )}
          </Button>
        </div>

        {snapshotDataUrl && (
          <div className="rounded-lg overflow-hidden border">
            <img src={snapshotDataUrl} alt="Captured snapshot" className="w-full h-auto" />
          </div>
        )}

        {analysis && (
          <div className="space-y-3">
            <div className="rounded-lg border bg-card p-4">
              <p className="font-semibold">AI Summary</p>
              <p className="text-sm text-muted-foreground mt-2">{analysis.analysis}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {typeof analysis.estimatedPigletsVisible === 'number' && (
                  <Badge variant="secondary">Piglets visible: {analysis.estimatedPigletsVisible}</Badge>
                )}
                {analysis.activitySummary && <Badge variant="secondary">{analysis.activitySummary}</Badge>}
                <Badge variant="outline">Urgency: {analysis.urgencyLevel.toUpperCase()}</Badge>
              </div>
            </div>

            {analysis.observations.length > 0 && (
              <div className="rounded-lg border bg-card p-4">
                <p className="font-semibold">Observations</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {analysis.observations.map((o, idx) => (
                    <li key={idx}>- {o}</li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.recommendations.length > 0 && (
              <div className="rounded-lg border bg-card p-4">
                <p className="font-semibold">Recommendations</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {analysis.recommendations.map((r, idx) => (
                    <li key={idx}>- {r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
