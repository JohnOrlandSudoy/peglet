import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getReadingsBetween } from '@/lib/supabase';
import { PigletReading } from '@/types';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarDays, Loader as Loader2 } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

const toDatetimeLocalValue = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
};

const parseDatetimeLocal = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const HistoryBrowser = () => {
  const [range, setRange] = useState<DateRange>(() => {
    const now = new Date();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return { from, to: now };
  });
  const [fromTime, setFromTime] = useState(() => toDatetimeLocalValue(new Date(Date.now() - 24 * 60 * 60 * 1000)));
  const [toTime, setToTime] = useState(() => toDatetimeLocalValue(new Date()));
  const [rows, setRows] = useState<PigletReading[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const resolvedFrom = useMemo(() => {
    const dt = parseDatetimeLocal(fromTime);
    return dt ?? range.from ?? null;
  }, [fromTime, range.from]);

  const resolvedTo = useMemo(() => {
    const dt = parseDatetimeLocal(toTime);
    return dt ?? range.to ?? null;
  }, [toTime, range.to]);

  const isValid = resolvedFrom && resolvedTo && resolvedFrom.getTime() <= resolvedTo.getTime();

  const apply = async () => {
    if (!resolvedFrom || !resolvedTo) return;
    setIsLoading(true);
    try {
      const data = await getReadingsBetween({
        fromIso: resolvedFrom.toISOString(),
        toIso: resolvedTo.toISOString(),
        limit: 2000
      });
      setRows(data);
    } finally {
      setIsLoading(false);
    }
  };

  const pickRange = (next: DateRange | undefined) => {
    const updated: DateRange = next ?? { from: undefined, to: undefined };
    setRange(updated);
    if (updated.from) {
      const d = new Date(updated.from);
      d.setHours(0, 0, 0, 0);
      setFromTime(toDatetimeLocalValue(d));
    }
    if (updated.to) {
      const d = new Date(updated.to);
      d.setHours(23, 59, 0, 0);
      setToTime(toDatetimeLocalValue(d));
    }
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>History</span>
          <Badge variant="secondary">{rows.length} rows</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <CalendarDays className="w-4 h-4" />
                  {range.from && range.to
                    ? `${range.from.toLocaleDateString()} → ${range.to.toLocaleDateString()}`
                    : 'Pick date range'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="range" selected={range} onSelect={pickRange} numberOfMonths={2} />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Input
              type="datetime-local"
              value={fromTime}
              onChange={(e) => setFromTime(e.target.value)}
            />
          </div>

          <div>
            <Input
              type="datetime-local"
              value={toTime}
              onChange={(e) => setToTime(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button className="w-full" onClick={() => void apply()} disabled={!isValid || isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading
                </>
              ) : (
                'Load'
              )}
            </Button>
          </div>
        </div>

        <div className="rounded-lg border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Timestamp</TableHead>
                <TableHead>Core</TableHead>
                <TableHead>Ambient</TableHead>
                <TableHead>Hum</TableHead>
                <TableHead>NH₃</TableHead>
                <TableHead>Fan</TableHead>
                <TableHead>Pump</TableHead>
                <TableHead>Heater</TableHead>
                <TableHead>Spare</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                    No rows loaded. Select a date/time range and press Load.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{new Date(r.created_at).toLocaleString()}</TableCell>
                    <TableCell>{Number(r.core_temperature).toFixed(2)}°C</TableCell>
                    <TableCell>{Number(r.ambient_temperature).toFixed(2)}°C</TableCell>
                    <TableCell>{Number(r.humidity).toFixed(1)}%</TableCell>
                    <TableCell>{Number(r.ammonia_ppm).toFixed(1)} ppm</TableCell>
                    <TableCell>
                      <Badge variant={r.cooling_fan_status ? 'default' : 'secondary'}>{r.cooling_fan_status ? 'ON' : 'OFF'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.water_pump_status ? 'default' : 'secondary'}>{r.water_pump_status ? 'ON' : 'OFF'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.heater_fan_status ? 'default' : 'secondary'}>{r.heater_fan_status ? 'ON' : 'OFF'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.spare_relay_status ? 'default' : 'secondary'}>{r.spare_relay_status ? 'ON' : 'OFF'}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
