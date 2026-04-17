import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PigletReading } from '@/types';
import {
  getLatestReading,
  getRecentReadings,
  subscribeToReadings,
  setSpareRelayCommand,
  getSpareRelayCommand,
  subscribeToRelayCommands
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
import { HistoryBrowser } from './HistoryBrowser';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Thermometer,
  Droplets,
  Wind,
  Gauge,
  Activity,
  CircleAlert as AlertCircle,
  WifiOff,
  Wifi,
  Bell,
  Loader as Loader2
} from 'lucide-react';
import { toast } from 'sonner';

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: unknown) => void>;
    __pegletOneSignalInitPromise?: Promise<void>;
  }
}

export const Dashboard = () => {
  const [latestReading, setLatestReading] = useState<PigletReading | null>(null);
  const [recentReadings, setRecentReadings] = useState<PigletReading[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [initialLoadState, setInitialLoadState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [initialLoadError, setInitialLoadError] = useState<string | null>(null);
  const [spareRelayRequested, setSpareRelayRequested] = useState<boolean | null>(null);
  const [spareRelayPending, setSpareRelayPending] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof Notification === 'undefined') return 'denied';
    return Notification.permission;
  });
  const [isEnablingNotifications, setIsEnablingNotifications] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkStandalone = () => {
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
      setIsStandalone(standalone);
    };
    checkStandalone();
    window.addEventListener('appinstalled', () => {
      toast.success('App Installed!', {
        description: 'Successfully added to home screen. Open it from your apps for a better experience.'
      });
      setIsStandalone(true);
    });
  }, []);

  useEffect(() => {
    // If standalone but notifications not enabled, prompt automatically after a short delay
    if (isStandalone && notificationPermission === 'default') {
      const timer = setTimeout(() => {
        toast.message('Enable Alerts?', {
          description: 'Gusto mo bang makatanggap ng alerts kahit sarado ang app?',
          action: {
            label: 'Enable',
            onClick: () => void enableNotifications()
          }
        });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isStandalone, notificationPermission]);

  const [bannerDismissals, setBannerDismissals] = useState<Record<string, { dismissed: boolean; activeSince: string }>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem('peglet_banner_dismissals_v1');
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, { dismissed?: unknown; activeSince?: unknown }>;
      const next: Record<string, { dismissed: boolean; activeSince: string }> = {};
      for (const [key, value] of Object.entries(parsed)) {
        const dismissed = Boolean(value?.dismissed);
        const activeSince = typeof value?.activeSince === 'string' ? value.activeSince : '';
        if (activeSince.length > 0) next[key] = { dismissed, activeSince };
      }
      return next;
    } catch {
      return {};
    }
  });
  const latestReadingRef = useRef<PigletReading | null>(null);
  const secondsSinceUpdate = lastUpdated ? Math.max(0, Math.floor((now.getTime() - lastUpdated.getTime()) / 1000)) : null;
  const isStale = secondsSinceUpdate !== null ? secondsSinceUpdate > 30 : true;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('peglet_banner_dismissals_v1', JSON.stringify(bannerDismissals));
    } catch {
      return;
    }
  }, [bannerDismissals]);

  useEffect(() => {
    const update = () => {
      if (typeof Notification === 'undefined') return;
      setNotificationPermission(Notification.permission);
    };
    update();
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  const enableNotifications = async (silent: boolean = false) => {
    if (typeof window === 'undefined') return;
    if (typeof Notification === 'undefined') {
      if (!silent) toast.error('Notifications not supported on this device/browser');
      return;
    }

    const appId: string | undefined = import.meta.env.VITE_ONESIGNAL_APP_ID;
    const safariWebId: string | undefined = import.meta.env.VITE_ONESIGNAL_SAFARI_WEB_ID;
    if (!appId) {
      if (!silent) toast.error('Missing OneSignal App ID (VITE_ONESIGNAL_APP_ID)');
      return;
    }

    const isSecure = window.isSecureContext || window.location.hostname === 'localhost';
    if (!isSecure) {
      if (!silent) toast.error('Push notifications require HTTPS');
      return;
    }

    if (!silent) setIsEnablingNotifications(true);
    try {
      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector('script[data-onesignal="true"]') as HTMLScriptElement | null;
        if (existing) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
        script.defer = true;
        script.dataset.onesignal = 'true';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load OneSignal SDK'));
        document.head.appendChild(script);
      });

      window.OneSignalDeferred = window.OneSignalDeferred || [];

      if (!window.__pegletOneSignalInitPromise) {
        window.__pegletOneSignalInitPromise = new Promise<void>((resolve, reject) => {
          window.OneSignalDeferred!.push(async (OneSignal) => {
            try {
              const os = OneSignal as {
                init: (options: Record<string, unknown>) => Promise<void>;
                Debug: { setLogLevel: (level: string) => void };
              };
              os.Debug.setLogLevel('warn');
              await os.init({
                appId,
                safari_web_id: safariWebId,
                notifyButton: {
                  enable: true,
                },
                serviceWorkerPath: '/OneSignalSDKWorker.js',
                serviceWorkerUpdaterPath: '/OneSignalSDKUpdaterWorker.js',
                allowLocalhostAsSecureOrigin: true,
                welcomeNotification: { disable: true }
              });
              resolve();
            } catch (err) {
              reject(err);
            }
          });
        });
      }

      await window.__pegletOneSignalInitPromise;

      await new Promise<void>((resolve, reject) => {
        window.OneSignalDeferred!.push(async (OneSignal) => {
          try {
            const os = OneSignal as {
              Notifications: {
                isPushSupported: () => boolean;
                requestPermission: () => Promise<void> | void;
                permission: boolean;
                setDefaultTitle: (title: string) => void;
                setDefaultUrl: (url: string) => void;
              };
              User: {
                PushSubscription: {
                  optIn: () => Promise<void> | void;
                  optedIn: boolean;
                };
              };
            };

            if (!os.Notifications.isPushSupported()) {
              if (!silent) toast.error('Push not supported on this device/browser');
              resolve();
              return;
            }

            if (!silent) {
              await os.Notifications.requestPermission();
              await os.User.PushSubscription.optIn();
            }
            
            os.Notifications.setDefaultTitle('Smart Piglet Health Monitor');
            os.Notifications.setDefaultUrl(window.location.origin);

            if (os.Notifications.permission && os.User.PushSubscription.optedIn) {
              if (!silent) {
                toast.success('Notifications enabled', {
                  description: 'Makaka-receive ka na ng alerts kahit sarado ang web app (basta may internet).'
                });
              }
            } else if (Notification.permission === 'denied') {
              if (!silent) {
                toast.error('Notifications blocked', {
                  description: 'I-enable sa browser/site settings para gumana ulit.'
                });
              }
            } else {
              if (!silent) toast.message('Notifications not enabled yet');
            }

            setNotificationPermission(Notification.permission);
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'Unknown error';
      if (rawMessage.toLowerCase().includes('not configure') && rawMessage.toLowerCase().includes('web push')) {
        if (!silent) {
          toast.error('App not configured for Web Push', {
            description: `Check OneSignal Web Settings “Site URL” matches this site: ${window.location.origin} (use your production domain, not localhost/vercel preview).`
          });
        }
        return;
      }
      if (!silent) {
        toast.error('Failed to enable notifications', {
          description: rawMessage
        });
      }
    } finally {
      if (!silent) setIsEnablingNotifications(false);
    }
  };

  useEffect(() => {
    // If permission already granted, initialize OneSignal silently on load
    if (Notification.permission === 'granted') {
      void enableNotifications(true);
    }
  }, []);

  const activeBanners = useMemo(() => {
    if (!latestReading) return [];

    const items: Array<{
      key: string;
      tone: 'critical' | 'warning' | 'info';
      title: string;
      description: string;
      className: string;
      accentClassName?: string;
    }> = [];

    if (isStale) {
      items.push({
        key: 'stale',
        tone: 'info',
        title: 'No recent data',
        description: 'Walang bagong readings. Check WiFi/ESP32 power at Supabase connection.',
        className: 'bg-muted/50 border border-border',
        accentClassName: 'text-muted-foreground'
      });
    }

    if (latestReading.cooling_fan_status) {
      items.push({
        key: 'cooling-on',
        tone: 'info',
        title: 'Cooling is ON',
        description: 'Siguraduhin na sarado ang room/kulungan para hindi sumingaw ang lamig (aircon/cooling).',
        className:
          'bg-gradient-to-r from-blue-500/15 to-cyan-500/10 border-2 border-blue-500 ring-2 ring-blue-500/30 shadow-lg animate-pulse',
        accentClassName: 'text-blue-500'
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
    if (!latestReading) return;
    setBannerDismissals((prev) => {
      const activeKeys = new Set(activeBanners.map((b) => b.key));
      let changed = false;
      const next: Record<string, { dismissed: boolean; activeSince: string }> = { ...prev };

      for (const key of Object.keys(next)) {
        if (!activeKeys.has(key)) {
          delete next[key];
          changed = true;
        }
      }

      for (const key of activeKeys) {
        if (!next[key]) {
          next[key] = { dismissed: false, activeSince: latestReading.created_at };
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [activeBanners, latestReading]);

  const dismissBanner = useCallback(
    (key: string) => {
      setBannerDismissals((prev) => {
        const activeSince = prev[key]?.activeSince ?? latestReading?.created_at ?? new Date().toISOString();
        return { ...prev, [key]: { dismissed: true, activeSince } };
      });
    },
    [latestReading]
  );

  const banners = useMemo(
    () => activeBanners.filter((b) => !bannerDismissals[b.key]?.dismissed),
    [activeBanners, bannerDismissals]
  );

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

        const command = await getSpareRelayCommand('default');
        if (!cancelled) setSpareRelayRequested(command);
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
        const prevCooling = prev ? Boolean(prev.cooling_fan_status) : null;
        const nextAmmonia = Number(incoming.ammonia_ppm);
        const nextCoreTemp = Number(incoming.core_temperature);
        const nextCooling = Boolean(incoming.cooling_fan_status);

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

        if ((prevCooling === null || prevCooling === false) && nextCooling) {
          toast.message('Cooling is ON', {
            description: 'Isara ang room/kulungan para hindi sumingaw ang lamig (aircon/cooling).'
          });
        }

        setIsLive(true);
        setTimeout(() => setIsLive(false), 3000);
      }
    });

    const unsubscribeRelayCommands = subscribeToRelayCommands((next) => {
      setSpareRelayRequested(next.spare_relay_on);
    }, 'default');

    return () => {
      cancelled = true;
      unsubscribe();
      unsubscribeRelayCommands();
      clearInterval(clock);
    };
  }, []);

  useEffect(() => {
    if (!latestReading) return;
    if (spareRelayRequested === null) return;
    if (!spareRelayPending) return;
    if (latestReading.spare_relay_status === spareRelayRequested) {
      setSpareRelayPending(false);
    }
  }, [latestReading, spareRelayPending, spareRelayRequested]);

  const handleToggleSpareRelay = async (next: boolean) => {
    if (!latestReading) return;

    const previousRequested = spareRelayRequested ?? latestReading.spare_relay_status;
    setSpareRelayRequested(next);
    setSpareRelayPending(true);

    try {
      await setSpareRelayCommand(next);

      toast.success('Spare Relay Updated', {
        description: `Requested: ${next ? 'ON' : 'OFF'} (ESP32 will apply on next sync)`
      });
    } catch {
      setSpareRelayRequested(previousRequested);
      setSpareRelayPending(false);
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
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent truncate">
                  Smart Piglet Health Monitor
                </h1>
                <p className="text-sm text-muted-foreground">Real-time IoT Monitoring System</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant={notificationPermission === 'granted' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => void enableNotifications()}
                disabled={isEnablingNotifications}
                className="gap-2"
              >
                {isEnablingNotifications ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Bell className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">
                  {notificationPermission === 'granted'
                    ? 'Alerts On'
                    : notificationPermission === 'denied'
                      ? 'Alerts Blocked'
                      : 'Enable Alerts'}
                </span>
              </Button>
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
            <div
              key={b.key}
              className={`${b.className} rounded-lg p-4 flex flex-col sm:flex-row sm:items-start gap-3`}
            >
              <AlertCircle
                className={`w-6 h-6 flex-shrink-0 mt-0.5 ${
                  b.accentClassName ??
                  (b.tone === 'critical' ? 'text-red-500' : b.tone === 'warning' ? 'text-orange-500' : 'text-blue-500')
                }`}
              />
              <div className="flex-1">
                <h3
                  className={`font-bold text-lg ${
                    b.accentClassName ??
                    (b.tone === 'critical' ? 'text-red-500' : b.tone === 'warning' ? 'text-orange-500' : 'text-blue-500')
                  }`}
                >
                  {b.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">{b.description}</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => dismissBanner(b.key)}
                className="self-start sm:self-center"
              >
                OK
              </Button>
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
                spareRelayRequested={spareRelayRequested ?? latestReading.spare_relay_status}
                spareRelayActual={latestReading.spare_relay_status}
                spareRelayPending={spareRelayPending && spareRelayRequested !== null && latestReading.spare_relay_status !== spareRelayRequested}
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

          <HistoryBrowser />

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
