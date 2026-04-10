import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Fan, Droplets, Power, CircleAlert as AlertCircle } from 'lucide-react';

interface RelayControlProps {
  coolingFan: boolean;
  waterPump: boolean;
  spareRelay: boolean;
  heaterFan?: boolean;
  ammoniaLevel: number;
  onToggleSpareRelay: () => void;
}

export const RelayControl = ({
  coolingFan,
  waterPump,
  spareRelay,
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
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${coolingFan ? 'bg-blue-500/10' : 'bg-gray-500/10'}`}>
              <Fan className={`w-5 h-5 ${coolingFan ? 'text-blue-500 animate-spin' : 'text-gray-500'}`} />
            </div>
            <div>
              <p className="font-semibold">Cooling Fan</p>
              <p className="text-xs text-muted-foreground">Temperature Control</p>
            </div>
          </div>
          <Badge variant={coolingFan ? 'default' : 'secondary'}>
            {coolingFan ? 'ON' : 'OFF'}
          </Badge>
        </div>

        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
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
          <div className="flex items-center gap-2">
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

        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${spareRelay ? 'bg-purple-500/10' : 'bg-gray-500/10'}`}>
              <Power className={`w-5 h-5 ${spareRelay ? 'text-purple-500' : 'text-gray-500'}`} />
            </div>
            <div>
              <p className="font-semibold">Spare Relay</p>
              <p className="text-xs text-muted-foreground">Manual Control</p>
            </div>
          </div>
          <Switch
            checked={spareRelay}
            onCheckedChange={onToggleSpareRelay}
          />
        </div>

        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${heaterFan ? 'bg-amber-500/10' : 'bg-gray-500/10'}`}>
              <Fan className={`w-5 h-5 ${heaterFan ? 'text-amber-500' : 'text-gray-500'}`} />
            </div>
            <div>
              <p className="font-semibold">Heater Fan</p>
              <p className="text-xs text-muted-foreground">Cold Weather Support</p>
            </div>
          </div>
          <Badge variant={heaterFan ? 'default' : 'secondary'}>
            {heaterFan ? 'ON' : 'OFF'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};
