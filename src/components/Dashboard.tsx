import { useEffect, useMemo, useRef, useState } from 'react';
import { PigletReading } from '@/types';
import {
  getLatestReading,
  getRecentReadings,
  subscribeToReadings,
  setSpareRelayCommand
} from '@/lib/supabase';
import {
  getCoreTemperatureStatus,
  getAmmoniaStatus,
  getHumidityStatus,
  getAmbientTemperatureStatus
} from '@/lib/thresholds';
import { StatusCard } from './StatusCard';
import { RelayControl } from './RelayControl';
import { Charts } from './Charts';
import { AIAnalysis } from './AIAnalysis';
import { VisualMonitoring } from './VisualMonitoring';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Thermometer, Droplets, Wind, Gauge, Activity, CircleAlert as AlertCircle, WifiOff, Wifi } from 'lucide-react';
import { toast } from 'sonner';

export const Dashboard = () => {
  const [latestReading, setLatestReading] = useState<PigletReading | null>(null);
  const [recentReadings, setRecentReadings] = useState<PigletReading[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [initialLoadState, setInitialLoadState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [initialLoadError, setInitialLoadError] = useState<string | null>(null);
  const latestReadingRef = useRef<PigletReading | null>(null);
  const secondsSinceUpdate = lastUpdated ? Math.max(0, Math.floor((now.getTime() - lastUpdated.getTime()) / 1000)) : null;
  const isStale = secondsSinceUpdate !== null ? secondsSinceUpdate > 30 : true;

  const banners = useMemo(() => {
    if (!latestReading) return [];

    const items: Array<{
      key: string;
      tone: 'critical' | 'warning' | 'info';
      title: string;
      description: string;
      className: string;
    }> = [];

    if (isStale) {
      items.push({
        key: 'stale',
        tone: 'info',
        title: 'No recent data',
        description: 'Walang bagong readings. Check WiFi/ESP32 power at Supabase connection.',
        className: 'bg-muted/50 border border-border'
      });
    }

    if (Number(latestReading.core_temperature) < 34) {
      items.push({
        key: 'core-low',
        tone: 'critical',
        title: 'Low Core Temperature',
        description: 'Hypothermia risk. Warm the piglets (bedding/heating) and monitor closely.',
        className: 'bg-blue-500/10 border-2 border-blue-500'
      });
    }

    if (Number(latestReading.core_temperature) >= 40) {
      items.push({
        key: 'core-high',
        tone: 'critical',
        title: 'Critical High Temperature',
        description: 'Possible fever/heat stress. Start cooling/ventilation and check piglets immediately.',
        className: 'bg-red-500/10 border-2 border-red-500'
      });
    }

    if (Number(latestReading.ammonia_ppm) >= 25) {
      items.push({
        key: 'nh3-hazard',
        tone: 'critical',
        title: 'Hazardous Ammonia Level',
        description: 'Increase ventilation and check manure/bedding. Verify sensors and relay actions.',
        className: 'bg-red-500/10 border-2 border-red-500'
      });
    } else if (Number(latestReading.ammonia_ppm) >= 11) {
      items.push({
        key: 'nh3-harmful',
        tone: 'warning',
        title: 'Harmful Ammonia Level',
        description: 'Water pump should be AUTO ON (NH₃ ≥ 11 ppm). Improve ventilation and keep monitoring.',
        className: 'bg-orange-500/10 border-2 border-orange-500'
      });
    }

    return items;
  }, [isStale, latestReading]);

  useEffect(() => {
    let cancelled = false;

    const withTimeout = async <T,>(promise: Promise<T>, ms: number) => {
      let timeoutId: number | undefined;
      const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error('Request timed out')), ms);
      });
      try {
        return await Promise.race([promise, timeoutPromise]);
      } finally {
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      }
    };

    const load = async () => {
      setInitialLoadState('loading');
      setInitialLoadError(null);
      try {
        const [reading, readings] = await withTimeout(
          Promise.all([getLatestReading(), getRecentReadings(60)]),
          12000
        );

        if (cancelled) return;

        setRecentReadings(readings);

        const resolvedLatest = reading ?? (readings.length > 0 ? readings[readings.length - 1] : null);
        if (resolvedLatest) {
          latestReadingRef.current = resolvedLatest;
          setLatestReading(resolvedLatest);
          setLastUpdated(new Date(resolvedLatest.created_at));
          setInitialLoadState('ready');
        } else {
          setLatestReading(null);
          setLastUpdated(null);
          setInitialLoadState('empty');
        }
      } catch (err) {
        if (cancelled) return;
        setInitialLoadError(err instanceof Error ? err.message : 'Failed to load data');
        setInitialLoadState('error');
      }
    };

    void load();

    const clock = setInterval(() => setNow(new Date()), 1000);

    const unsubscribe = subscribeToReadings((incoming, event) => {
      const prev = latestReadingRef.current;
      const incomingCreatedAt = new Date(incoming.created_at).getTime();
      const prevCreatedAt = prev ? new Date(prev.created_at).getTime() : null;

      const shouldAcceptAsLatest =
        event === 'INSERT'
          ? prevCreatedAt === null || incomingCreatedAt >= prevCreatedAt
          : prev ? incoming.id === prev.id : false;

      if (event === 'INSERT') {
        setRecentReadings((current) => [...current.slice(-59), incoming]);
      } else {
        setRecentReadings((current) => {
          const index = current.findIndex((r) => r.id === incoming.id);
          if (index === -1) return current;
          const next = current.slice();
          next[index] = incoming;
          return next;
        });
      }

      if (!shouldAcceptAsLatest) return;

      latestReadingRef.current = incoming;
      setLatestReading(incoming);
      setLastUpdated(new Date(incoming.created_at));
      setInitialLoadState('ready');

      if (event === 'INSERT') {
        const prevAmmonia = prev ? Number(prev.ammonia_ppm) : null;
        const prevCoreTemp = prev ? Number(prev.core_temperature) : null;
        const nextAmmonia = Number(incoming.ammonia_ppm);
        const nextCoreTemp = Number(incoming.core_temperature);

        if ((prevAmmonia === null || prevAmmonia < 11) && nextAmmonia >= 11) {
          toast.warning('Ammonia Alert: Water Pump AUTO ON', {
            description: `NH₃ reached ${nextAmmonia.toFixed(1)} ppm`
          });
        }

        if ((prevAmmonia === null || prevAmmonia < 25) && nextAmmonia >= 25) {
          toast.error('Hazardous Ammonia Level!', {
            description: `NH₃ is ${nextAmmonia.toFixed(1)} ppm — increase ventilation immediately`
          });
        }

        if ((prevCoreTemp === null || prevCoreTemp >= 34) && nextCoreTemp < 34) {
          toast.warning('Low Core Temperature', {
            description: `Core temp: ${nextCoreTemp.toFixed(1)}°C — warm the piglets immediately`
          });
        }

        if ((prevCoreTemp === null || prevCoreTemp < 40) && nextCoreTemp >= 40) {
          toast.error('Critical Temperature Alert!', {
            description: `Core temp: ${nextCoreTemp.toFixed(1)}°C — check piglets immediately`
          });
        }

        setIsLive(true);
        setTimeout(() => setIsLive(false), 3000);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
      clearInterval(clock);
    };
  }, []);

  const handleToggleSpareRelay = async () => {
    if (!latestReading) return;

    try {
      const newStatus = !latestReading.spare_relay_status;
      await setSpareRelayCommand(newStatus);

      toast.success('Spare Relay Updated', {
        description: `Requested: ${newStatus ? 'ON' : 'OFF'} (ESP32 will apply on next sync)`
      });
    } catch {
      toast.error('Failed to send spare relay command');
    }
  };

  if (!latestReading) {
    if (initialLoadState === 'empty') {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md px-6">
            <Activity className="w-16 h-16 mx-auto text-primary" />
            <p className="text-xl font-semibold">Wala pang data</p>
            <p className="text-muted-foreground">
              Waiting sa bagong insert mula sa ESP32. Check mo kung connected ang ESP32 sa WiFi at kung nagse-send na sa Supabase.
            </p>
          </div>
        </div>
      );
    }

    if (initialLoadState === 'error') {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md px-6">
            <AlertCircle className="w-16 h-16 mx-auto text-orange-500" />
            <p className="text-xl font-semibold">Hindi makaconnect sa monitoring system</p>
            <p className="text-muted-foreground">
              {initialLoadError ?? 'Check Supabase URL/anon key at network connection.'}
            </p>
            <Button
              onClick={() => {
                setInitialLoadState('loading');
                setInitialLoadError(null);
                void (async () => {
                  const [reading, readings] = await Promise.all([getLatestReading(), getRecentReadings(60)]);
                  setRecentReadings(readings);
                  const resolvedLatest = reading ?? (readings.length > 0 ? readings[readings.length - 1] : null);
                  if (resolvedLatest) {
                    latestReadingRef.current = resolvedLatest;
                    setLatestReading(resolvedLatest);
                    setLastUpdated(new Date(resolvedLatest.created_at));
                    setInitialLoadState('ready');
                  } else {
                    setLatestReading(null);
                    setLastUpdated(null);
                    setInitialLoadState('empty');
                  }
                })();
              }}
            >
              Retry
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Activity className="w-16 h-16 animate-pulse mx-auto text-primary" />
          <p className="text-xl font-semibold">Loading Dashboard...</p>
          <p className="text-muted-foreground">Connecting to monitoring system</p>
        </div>
      </div>
    );
  }

  const coreTemp = getCoreTemperatureStatus(Number(latestReading.core_temperature));
  const ambientTemp = getAmbientTemperatureStatus(Number(latestReading.ambient_temperature));
  const humidity = getHumidityStatus(Number(latestReading.humidity));
  const ammonia = getAmmoniaStatus(Number(latestReading.ammonia_ppm));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50 backdrop-blur-lg bg-opacity-80">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  Smart Piglet Health Monitor
                </h1>
                <p className="text-sm text-muted-foreground">Real-time IoT Monitoring System</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isLive && (
                <Badge variant="default" className="bg-red-500 animate-pulse">
                  <span className="w-2 h-2 bg-white rounded-full mr-2" />
                  LIVE
                </Badge>
              )}
              <Badge variant={isStale ? 'secondary' : 'outline'} className="hidden sm:flex items-center gap-2">
                {isStale ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
                {isStale ? 'STALE' : 'REALTIME'}
              </Badge>
              {lastUpdated && (
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-muted-foreground">Last Updated</p>
                  <p className="text-sm font-semibold">
                    {lastUpdated.toLocaleString()}
                  </p>
                  {secondsSinceUpdate !== null && (
                    <p className="text-xs text-muted-foreground">{secondsSinceUpdate}s ago</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {banners.map((b) => (
            <div key={b.key} className={`${b.className} rounded-lg p-4 flex items-start gap-3`}>
              <AlertCircle
                className={`w-6 h-6 flex-shrink-0 mt-0.5 ${
                  b.tone === 'critical' ? 'text-red-500' : b.tone === 'warning' ? 'text-orange-500' : 'text-muted-foreground'
                }`}
              />
              <div>
                <h3
                  className={`font-bold text-lg ${
                    b.tone === 'critical' ? 'text-red-500' : b.tone === 'warning' ? 'text-orange-500' : 'text-foreground'
                  }`}
                >
                  {b.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">{b.description}</p>
              </div>
            </div>
          ))}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatusCard
              title="Core Temperature"
              icon={<Thermometer className="w-6 h-6 text-red-500" />}
              status={coreTemp}
              unit="°C"
              trend="stable"
            />
            <StatusCard
              title="Ambient Temperature"
              icon={<Gauge className="w-6 h-6 text-orange-500" />}
              status={ambientTemp}
              unit="°C"
              trend="stable"
            />
            <StatusCard
              title="Humidity"
              icon={<Droplets className="w-6 h-6 text-blue-500" />}
              status={humidity}
              unit="%"
              trend="stable"
            />
            <StatusCard
              title="Ammonia Level"
              icon={<Wind className="w-6 h-6 text-orange-500" />}
              status={ammonia}
              unit="ppm"
              trend="stable"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <RelayControl
                coolingFan={latestReading.cooling_fan_status}
                waterPump={latestReading.water_pump_status}
                spareRelay={latestReading.spare_relay_status}
                heaterFan={latestReading.heater_fan_status ?? false}
                ammoniaLevel={Number(latestReading.ammonia_ppm)}
                onToggleSpareRelay={handleToggleSpareRelay}
              />
            </div>
            <div className="lg:col-span-1">
              <AIAnalysis reading={latestReading} />
            </div>
          </div>

          <VisualMonitoring reading={latestReading} />

          {recentReadings.length > 0 && <Charts readings={recentReadings} />}
        </div>
      </main>

      <footer className="border-t mt-16 py-6 bg-card">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Smart Piglet Health Monitoring System - Powered by IoT & AI</p>
        </div>
      </footer>
    </div>
  );
};
