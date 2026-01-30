
export interface SlideItem {
  text: string;
  icon: string;
}

export interface Slide {
  title: string;
  content: SlideItem[];
  layout: 'steps' | 'comparison' | 'grid' | 'classic' | 'process';
  description: string;
  imageUrl?: string; // Slayd uchun AI tomonidan yaratilgan rasm
}

export interface Presentation {
  topic: string;
  mainTitle: string;
  subtitle: string;
  slides: Slide[];
  themeColor: string;
  coverImagePrompt: string;
}

export enum AppState {
  IDLE = 'IDLE',
  READING_FILE = 'READING_FILE',
  GENERATING = 'GENERATING',
  PREVIEW = 'PREVIEW',
  ERROR = 'ERROR'
}
