export interface ImageDimensions {
  width: number;
  height: number;
}

export type ResizeMode = 'pixels' | 'percentage';

export interface ResizeOptions {
  width: number;
  height: number;
  percentage: number;
  mode: ResizeMode;
  quality: number;
  format: 'image/jpeg' | 'image/png' | 'image/webp';
  maintainAspectRatio: boolean;
}

export interface AIAnalysisResult {
  description: string;
  keywords: string[];
  ecoTip: string;
}

export enum AppState {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  ANALYZING = 'ANALYZING',
  READY = 'READY',
}