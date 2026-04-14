import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Fan, Droplets, Power, CircleAlert as AlertCircle } from 'lucide-react';

interface RelayControlProps {
  coolingFan: boolean;
  waterPump: boolean;
  spareRelayRequested: boolean;
  spareRelayActual: boolean;
  spareRelayPending: boolean;
  heaterFan?: boolean;
  ammoniaLevel: number;
  onToggleSpareRelay: (next: boolean) => void;
}

export const RelayControl = ({
  coolingFan,
  waterPump,
  spareRelayRequested,
  spareRelayActual,
  spareRelayPending,
  heaterFan,
  ammoniaLevel,
  onToggleSpareRelay
}: RelayControlProps) => {
  const isWaterPumpAutoOn = ammoniaLevel >= 11;
  const isWaterPumpMismatch = isWaterPumpAutoOn && !waterPump;

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Power className="w-5 h-5" />
          Equipment Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${coolingFan ? 'bg-blue-500/10' : 'bg-gray-500/10'}`}>
              <Fan className={`w-5 h-5 ${coolingFan ? 'text-blue-500 animate-spin' : 'text-gray-500'}`} />
            </div>
            <div>
              <p className="font-semibold">Cooling Fan</p>
              <p className="text-xs text-muted-foreground">Temperature Control</p>
            </div>
          </div>
          <div className="flex justify-end">
            <Badge variant={coolingFan ? 'default' : 'secondary'}>{coolingFan ? 'ON' : 'OFF'}</Badge>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${waterPump ? 'bg-cyan-500/10' : 'bg-gray-500/10'}`}>
              <Droplets className={`w-5 h-5 ${waterPump ? 'text-cyan-500' : 'text-gray-500'}`} />
            </div>
            <div>
              <p className="font-semibold">Water Pump</p>
              <p className="text-xs text-muted-foreground">
                {isWaterPumpAutoOn ? 'Auto ON (NH₃ ≥ 11 ppm)' : 'Ammonia Control'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isWaterPumpAutoOn && (
              <AlertCircle className="w-4 h-4 text-orange-500" />
            )}
            {isWaterPumpAutoOn ? (
              <>
                <Badge className="bg-orange-500 hover:bg-orange-500 text-white">AUTO ON</Badge>
                <Badge variant={waterPump ? 'default' : 'secondary'}>
                  {waterPump ? 'RELAY ON' : 'RELAY OFF'}
                </Badge>
              </>
            ) : (
              <Badge variant={waterPump ? 'default' : 'secondary'}>
                {waterPump ? 'ON' : 'OFF'}
              </Badge>
            )}
          </div>
        </div>

        {isWaterPumpMismatch && (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-orange-500/40 bg-orange-500/10">
            <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-orange-500">AUTO ON expected</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ammonia is high, but the water pump relay is still OFF. Check ESP32 relay wiring, power supply, or control logic.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${spareRelayActual ? 'bg-purple-500/10' : 'bg-gray-500/10'}`}>
              <Power className={`w-5 h-5 ${spareRelayActual ? 'text-purple-500' : 'text-gray-500'}`} />
            </div>
            <div>
              <p className="font-semibold">Spare Relay</p>
              <p className="text-xs text-muted-foreground">
                Manual Control{spareRelayPending ? ' • syncing…' : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge variant={spareRelayRequested ? 'default' : 'secondary'}>
                REQ {spareRelayRequested ? 'ON' : 'OFF'}
              </Badge>
              <Badge
                variant={spareRelayActual ? 'default' : 'secondary'}
                className={spareRelayPending ? 'opacity-70' : undefined}
              >
                ACT {spareRelayActual ? 'ON' : 'OFF'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground w-8 text-right">
                {spareRelayRequested ? 'ON' : 'OFF'}
              </span>
              <Switch
                checked={spareRelayRequested}
                disabled={spareRelayPending}
                onCheckedChange={onToggleSpareRelay}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${heaterFan ? 'bg-amber-500/10' : 'bg-gray-500/10'}`}>
              <Fan className={`w-5 h-5 ${heaterFan ? 'text-amber-500' : 'text-gray-500'}`} />
            </div>
            <div>
              <p className="font-semibold">Heater Fan</p>
              <p className="text-xs text-muted-foreground">Cold Weather Support</p>
            </div>
          </div>
          <div className="flex justify-end">
            <Badge variant={heaterFan ? 'default' : 'secondary'}>{heaterFan ? 'ON' : 'OFF'}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
