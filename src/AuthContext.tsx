import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser, signInWithPopup, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebase';
import { UserProfile, PublicProfile, Achievement } from './types';

const ACHIEVEMENTS: Omit<Achievement, 'unlockedAt'>[] = [
  { id: 'word_smith', title: 'Word Smith', description: 'Learn 10 words', icon: '✍️' },
  { id: 'vocab_master', title: 'Vocabulary Master', description: 'Learn 100 words', icon: '📚' },
  { id: 'consistent_learner', title: 'Consistent Learner', description: 'Maintain a 7-day streak', icon: '🔥' },
  { id: 'xp_champion', title: 'XP Champion', description: 'Reach 1000 XP', icon: '🏆' },
  { id: 'level_up', title: 'High Flyer', description: 'Reach Level 5', icon: '🚀' },
  { id: 'master_of_ten', title: 'Master of Ten', description: 'Master 10 words', icon: '🎓' },
];

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        // Initial profile creation if it doesn't exist
        const userDoc = await getDoc(userDocRef);
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        if (!userDoc.exists()) {
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            xp: 0,
            level: 1,
            streak: 1,
            dailyGoal: 10,
            wordsLearnedToday: 0,
            totalWordsLearned: 0,
            totalWordsMastered: 0,
            achievements: [],
            lastActive: now.toISOString(),
          };
          try {
            await setDoc(userDocRef, newProfile);
            // Create public profile
            const publicProfile: PublicProfile = {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              xp: 0,
              level: 1,
              streak: 1,
              totalWordsLearned: 0,
              totalWordsMastered: 0,
              achievements: [],
            };
            await setDoc(doc(db, 'users_public', firebaseUser.uid), publicProfile);
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, `users/${firebaseUser.uid}`);
          }
        } else {
          const existingProfile = userDoc.data() as UserProfile;
          const lastActiveDate = existingProfile.lastActive ? existingProfile.lastActive.split('T')[0] : '';
          
          let newStreak = existingProfile.streak;
          let newWordsLearnedToday = existingProfile.wordsLearnedToday;

          if (lastActiveDate !== today) {
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            if (lastActiveDate === yesterdayStr) {
              newStreak += 1;
            } else {
              newStreak = 1; // Reset streak if missed a day
            }
            newWordsLearnedToday = 0; // Reset daily count
          }

          await setDoc(userDocRef, { 
            ...existingProfile, 
            streak: newStreak, 
            wordsLearnedToday: newWordsLearnedToday,
            totalWordsLearned: existingProfile.totalWordsLearned ?? 0,
            totalWordsMastered: existingProfile.totalWordsMastered ?? 0,
            achievements: existingProfile.achievements ?? [],
            lastActive: now.toISOString() 
          }, { merge: true });
        }

        // Listen for profile changes
        const unsubscribeProfile = onSnapshot(userDocRef, (doc) => {
          if (doc.exists()) {
            setProfile(doc.data() as UserProfile);
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        });

        setLoading(false);
        return () => unsubscribeProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Sign in error:', error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const checkAchievements = (p: UserProfile): Achievement[] => {
    const newAchievements: Achievement[] = [...p.achievements];
    const now = new Date().toISOString();

    const checkAndAdd = (id: string, condition: boolean) => {
      if (condition && !newAchievements.find(a => a.id === id)) {
        const achievement = ACHIEVEMENTS.find(a => a.id === id);
        if (achievement) {
          newAchievements.push({ ...achievement, unlockedAt: now });
        }
      }
    };

    checkAndAdd('word_smith', p.totalWordsLearned >= 10);
    checkAndAdd('vocab_master', p.totalWordsLearned >= 100);
    checkAndAdd('consistent_learner', p.streak >= 7);
    checkAndAdd('xp_champion', p.xp >= 1000);
    checkAndAdd('level_up', p.level >= 5);
    checkAndAdd('master_of_ten', p.totalWordsMastered >= 10);

    return newAchievements;
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user || !profile) return;
    const userDocRef = doc(db, 'users', user.uid);
    const publicDocRef = doc(db, 'users_public', user.uid);
    
    let newProfile = { ...profile, ...updates };
    
    // Check for level up
    if (updates.xp !== undefined) {
      const newLevel = Math.floor(newProfile.xp / 100) + 1;
      if (newLevel > newProfile.level) {
        newProfile.level = newLevel;
      }
    }

    // Check for achievements
    const updatedAchievements = checkAchievements(newProfile);
    if (updatedAchievements.length > profile.achievements.length) {
      newProfile.achievements = updatedAchievements;
    }
    
    try {
      await setDoc(userDocRef, newProfile, { merge: true });
      
      // Sync public profile if relevant fields changed
      const publicFields: (keyof PublicProfile)[] = ['displayName', 'photoURL', 'xp', 'level', 'streak', 'achievements', 'totalWordsLearned', 'totalWordsMastered'];
      const hasPublicChanges = Object.keys(updates).some(key => publicFields.includes(key as keyof PublicProfile)) || 
                               updatedAchievements.length > profile.achievements.length;
      
      if (hasPublicChanges) {
        const publicUpdates: Partial<PublicProfile> = {};
        publicFields.forEach(field => {
          if (newProfile[field] !== undefined) {
            (publicUpdates as any)[field] = newProfile[field];
          }
        });
        await setDoc(publicDocRef, publicUpdates, { merge: true });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
