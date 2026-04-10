import { PigletReading } from '@/types';
import { PIGLET_THRESHOLDS } from '@/lib/thresholds';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

export interface GeminiAnalysis {
  analysis: string;
  recommendations: string[];
  urgencyLevel: 'low' | 'medium' | 'high';
}

export interface GeminiVisualAnalysis extends GeminiAnalysis {
  observations: string[];
  estimatedPigletsVisible?: number;
  activitySummary?: string;
}

const defaultAnalysis: GeminiAnalysis = {
  analysis: 'Gemini AI is not configured. Please add your VITE_GEMINI_API_KEY to the .env file.',
  recommendations: ['Configure Gemini API key to enable AI analysis'],
  urgencyLevel: 'low'
};

const defaultVisualAnalysis: GeminiVisualAnalysis = {
  analysis: defaultAnalysis.analysis,
  recommendations: defaultAnalysis.recommendations,
  urgencyLevel: defaultAnalysis.urgencyLevel,
  observations: []
};

const coerceUrgency = (value: unknown): GeminiAnalysis['urgencyLevel'] => {
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  return 'medium';
};

const extractJsonObject = (text: string) => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const dataUrlToInlineData = (dataUrl: string) => {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
};

export const analyzeWithGemini = async (
  reading: PigletReading,
  thresholds = PIGLET_THRESHOLDS
): Promise<GeminiAnalysis> => {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
    return defaultAnalysis;
  }

  const prompt = `You are an expert pig farming veterinarian and farm operations advisor. Analyze the following piglet monitoring readings and return actionable recommendations for the farmer.

Use these THRESHOLDS exactly:
${JSON.stringify(thresholds, null, 2)}

LATEST READING (from IoT / ESP32):
${JSON.stringify(
  {
    core_temperature_c: Number(reading.core_temperature),
    ambient_temperature_c: Number(reading.ambient_temperature),
    humidity_percent: Number(reading.humidity),
    ammonia_ppm: Number(reading.ammonia_ppm),
    relays: {
      cooling_fan_status: Boolean(reading.cooling_fan_status),
      water_pump_status: Boolean(reading.water_pump_status),
      spare_relay_status: Boolean(reading.spare_relay_status)
    },
    created_at: reading.created_at
  },
  null,
  2
)}

Return STRICT JSON only (no markdown) with this exact shape:
{
  "analysis": "2-3 sentences",
  "recommendations": ["3-7 short, actionable items"],
  "urgencyLevel": "low|medium|high"
}

Make recommendations practical (e.g. increase ventilation, start cooling, check piglets immediately, verify sensors, clean bedding, etc.).`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 800,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const jsonCandidate = extractJsonObject(text);
    if (jsonCandidate) {
      let parsed: Partial<GeminiAnalysis> | null = null;
      try {
        parsed = JSON.parse(jsonCandidate) as Partial<GeminiAnalysis>;
      } catch {
        parsed = null;
      }
      if (parsed) {
        const recommendations = Array.isArray(parsed.recommendations)
          ? parsed.recommendations.map(String).filter(Boolean)
          : [];
        return {
          analysis: typeof parsed.analysis === 'string' && parsed.analysis.trim().length > 0 ? parsed.analysis.trim() : text,
          recommendations:
            recommendations.length > 0 ? recommendations : ['Continue monitoring and keep the environment within thresholds.'],
          urgencyLevel: coerceUrgency(parsed.urgencyLevel)
        };
      }
    }

    const analysisMatch = text.match(/ANALYSIS:\s*(.+?)(?=RECOMMENDATIONS:|$)/s);
    const recommendationsMatch = text.match(/RECOMMENDATIONS:\s*(.+?)(?=URGENCY:|$)/s);
    const urgencyMatch = text.match(/URGENCY:\s*(\w+)/i);

    const analysis = analysisMatch ? analysisMatch[1].trim() : text;
    const recommendationsText = recommendationsMatch ? recommendationsMatch[1].trim() : '';
    const recommendations = recommendationsText
      .split('\n')
      .map((line: string) => line.replace(/^[-*]\s*/, '').trim())
      .filter((line: string) => line.length > 0);

    const urgencyLevel = coerceUrgency((urgencyMatch?.[1]?.toLowerCase() || 'medium') as string);

    return {
      analysis,
      recommendations: recommendations.length > 0 ? recommendations : ['Continue monitoring and keep the environment within thresholds.'],
      urgencyLevel
    };
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return {
      analysis: 'Unable to analyze at this moment. Please check your internet connection and API key configuration.',
      recommendations: ['Ensure stable internet connection', 'Verify Gemini API key is valid', 'Try again in a moment'],
      urgencyLevel: 'low'
    };
  }
};

export const analyzeVisualWithGemini = async (params: {
  reading: PigletReading;
  thresholds?: typeof PIGLET_THRESHOLDS;
  snapshotDataUrl: string;
  motionScore?: number;
}): Promise<GeminiVisualAnalysis> => {
  const { reading, snapshotDataUrl, motionScore } = params;
  const thresholds = params.thresholds ?? PIGLET_THRESHOLDS;

  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
    return defaultVisualAnalysis;
  }

  const inlineData = dataUrlToInlineData(snapshotDataUrl);
  if (!inlineData) {
    return {
      analysis: 'Invalid image format. Please try capturing the snapshot again.',
      recommendations: ['Retry capturing the snapshot'],
      urgencyLevel: 'low',
      observations: []
    };
  }

  const prompt = `You are an expert pig farming veterinarian and farm operations advisor.

Task: Analyze the piglet pen camera snapshot for health and behavior monitoring. Combine the visual findings with the latest IoT readings and thresholds. Return actionable recommendations for the farmer.

THRESHOLDS:
${JSON.stringify(thresholds, null, 2)}

LATEST IOT READING:
${JSON.stringify(
  {
    core_temperature_c: Number(reading.core_temperature),
    ambient_temperature_c: Number(reading.ambient_temperature),
    humidity_percent: Number(reading.humidity),
    ammonia_ppm: Number(reading.ammonia_ppm),
    relays: {
      cooling_fan_status: Boolean(reading.cooling_fan_status),
      water_pump_status: Boolean(reading.water_pump_status),
      spare_relay_status: Boolean(reading.spare_relay_status),
      heater_fan_status: Boolean(reading.heater_fan_status ?? false)
    },
    motion_score_0_100: typeof motionScore === 'number' ? Math.max(0, Math.min(100, motionScore)) : null,
    created_at: reading.created_at
  },
  null,
  2
)}

Visual focus:
- activity level (standing/lying, movement, lethargy cues)
- crowding (clumping vs spread out)
- posture issues / limping cues (if visible)
- breathing difficulty cues (if visible)
- missing piglets risk: estimate how many piglets are visible
- feeding/drinking behavior (if visible)

Return STRICT JSON only (no markdown) with this exact shape:
{
  "analysis": "2-4 sentences",
  "observations": ["3-10 short bullet-like observations from the image"],
  "estimatedPigletsVisible": 0,
  "activitySummary": "short phrase",
  "recommendations": ["3-10 short, actionable items"],
  "urgencyLevel": "low|medium|high"
}`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 900,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const jsonCandidate = extractJsonObject(text);
    if (jsonCandidate) {
      let parsed: Record<string, unknown> | null = null;
      try {
        const candidate = JSON.parse(jsonCandidate) as unknown;
        if (isRecord(candidate)) parsed = candidate;
      } catch {
        parsed = null;
      }
      if (parsed) {
        const recRaw = parsed.recommendations;
        const recommendations = Array.isArray(recRaw) ? recRaw.map(String).filter(Boolean) : [];

        const obsRaw = parsed.observations;
        const observations = Array.isArray(obsRaw) ? obsRaw.map(String).filter(Boolean) : [];

        const estimatedPigletsVisible =
          typeof parsed.estimatedPigletsVisible === 'number' ? parsed.estimatedPigletsVisible : undefined;

        const activitySummary = typeof parsed.activitySummary === 'string' ? parsed.activitySummary : undefined;

        const analysisText =
          typeof parsed.analysis === 'string' && parsed.analysis.trim().length > 0 ? parsed.analysis.trim() : text;

        return {
          analysis: analysisText,
          observations,
          estimatedPigletsVisible,
          activitySummary,
          recommendations:
            recommendations.length > 0 ? recommendations : ['Continue monitoring and keep the environment within thresholds.'],
          urgencyLevel: coerceUrgency(parsed.urgencyLevel)
        };
      }
    }

    return {
      analysis: text,
      observations: [],
      recommendations: ['Continue monitoring and keep the environment within thresholds.'],
      urgencyLevel: 'medium'
    };
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return {
      analysis: 'Unable to analyze the camera snapshot at this moment. Please check your internet connection and Gemini API key.',
      observations: [],
      recommendations: ['Ensure stable internet connection', 'Verify Gemini API key is valid', 'Try again in a moment'],
      urgencyLevel: 'low'
    };
  }
};
