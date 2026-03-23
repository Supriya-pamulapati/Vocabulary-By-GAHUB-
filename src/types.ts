export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL?: string | null;
  xp: number;
  level: number;
  streak: number;
  lastActive?: string;
  dailyGoal: number;
  wordsLearnedToday: number;
  totalWordsLearned: number;
  totalWordsMastered: number;
  achievements: Achievement[];
}

export interface PublicProfile {
  uid: string;
  displayName: string | null;
  photoURL?: string | null;
  xp: number;
  level: number;
  streak: number;
  totalWordsLearned: number;
  totalWordsMastered: number;
  achievements: Achievement[];
}

export interface Word {
  id?: string;
  userId: string;
  word: string;
  meaning: string;
  synonyms: string[];
  antonyms: string[];
  exampleSentence?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  nextReview: string;
  interval: number;
  repetition: number;
  easeFactor: number;
  status: 'new' | 'learning' | 'mastered';
  isStarred?: boolean;
  createdAt: string;
}

export interface QuizQuestion {
  word: string;
  options: string[];
  correctAnswer: string;
  type: 'meaning' | 'synonyms' | 'antonyms';
}
