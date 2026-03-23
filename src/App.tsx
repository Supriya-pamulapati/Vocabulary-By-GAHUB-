import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { Word, UserProfile, PublicProfile, Achievement } from './types';
import { db, handleFirestoreError, OperationType } from './firebase';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, orderBy, where, limit } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  LayoutDashboard, 
  Book, 
  Brain, 
  Gamepad2, 
  Settings, 
  LogOut, 
  ChevronRight, 
  ChevronDown,
  CheckCircle2, 
  Trophy, 
  Flame, 
  Star,
  X,
  Loader2,
  Volume2,
  ArrowRight,
  ArrowLeft,
  ArrowLeftRight,
  RotateCcw,
  Edit2,
  Trash2,
  Calendar,
  BarChart2,
  Layers,
  RefreshCcw,
  Copy,
  Check,
  Bell,
  Zap,
  TrendingUp,
  Clock
} from 'lucide-react';
import { getWordInfo } from './services/geminiService';

// --- Toast System ---

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

const ToastContainer = ({ toasts, removeToast }: { toasts: Toast[], removeToast: (id: string) => void }) => (
  <div className="fixed bottom-24 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
    <AnimatePresence>
      {toasts.map((toast) => (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, x: 20, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 20, scale: 0.9 }}
          className={`pointer-events-auto flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border-2 ${
            toast.type === 'success' ? 'bg-brand-50 border-brand-100 text-brand-700' :
            toast.type === 'error' ? 'bg-red-50 border-red-100 text-red-700' :
            'bg-blue-50 border-blue-100 text-blue-700'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
          {toast.type === 'error' && <X className="w-5 h-5" />}
          {toast.type === 'info' && <Bell className="w-5 h-5" />}
          <span className="font-bold text-sm">{toast.message}</span>
          <button onClick={() => removeToast(toast.id)} className="ml-2 opacity-50 hover:opacity-100 transition-opacity">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

// --- Components ---

const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setHasError(true);
      setErrorInfo(event.error?.message || 'An unknown error occurred.');
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-2 border-red-200">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="text-red-600 w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-6">{errorInfo}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-colors"
          >
            Reload App
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const LoadingScreen = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-white">
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
      className="mb-4"
    >
      <Loader2 className="w-12 h-12 text-emerald-500" />
    </motion.div>
    <p className="text-gray-500 font-medium animate-pulse">Loading your quest...</p>
  </div>
);

const LoginScreen = () => {
  const { signIn } = useAuth();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F7F7] p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center"
      >
        <div className="mb-8 flex justify-center">
          <div className="w-24 h-24 bg-emerald-500 rounded-3xl flex items-center justify-center shadow-lg transform -rotate-6">
            <Brain className="text-white w-12 h-12" />
          </div>
        </div>
        <h1 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">VocaQuest</h1>
        <p className="text-xl text-gray-600 mb-12 font-medium">Master new words, one quest at a time.</p>
        
        <button 
          onClick={signIn}
          className="w-full bg-white border-2 border-gray-200 text-gray-700 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-gray-50 transition-all shadow-sm active:scale-95"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/pjax/google.png" alt="Google" className="w-6 h-6" />
          Continue with Google
        </button>
        
        <p className="mt-8 text-sm text-gray-400">
          By continuing, you agree to start your vocabulary journey.
        </p>
      </motion.div>
    </div>
  );
};

// --- Main App Logic ---

const MainApp = () => {
  const { user, profile, logout, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'dictionary' | 'review' | 'quiz' | 'leaderboard' | 'settings'>('dashboard');
  const [words, setWords] = useState<Word[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingWord, setEditingWord] = useState<Word | null>(null);
  const [newWord, setNewWord] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'newest'>('newest');
  const [isStarredOnly, setIsStarredOnly] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    if (!user) return;
    const wordsRef = collection(db, 'users', user.uid, 'words');
    const q = query(wordsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const wordsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Word));
      setWords(wordsList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/words`);
    });

    return () => unsubscribe();
  }, [user]);

  const handleAddWord = async (wordData: Partial<Word>) => {
    if (!user) return;
    const wordsRef = collection(db, 'users', user.uid, 'words');
    const wordId = Math.random().toString(36).substring(7);
    const fullWord: Word = {
      userId: user.uid,
      word: wordData.word!,
      meaning: wordData.meaning!,
      synonyms: wordData.synonyms || [],
      antonyms: wordData.antonyms || [],
      exampleSentence: wordData.exampleSentence || '',
      difficulty: wordData.difficulty || 'medium',
      nextReview: new Date().toISOString(),
      interval: 0,
      repetition: 0,
      easeFactor: 2.5,
      status: 'new',
      isStarred: wordData.isStarred || false,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(wordsRef, wordId), fullWord);
      // Update XP and words learned today
      if (profile) {
        await updateProfile({
          xp: profile.xp + 10,
          wordsLearnedToday: profile.wordsLearnedToday + 1,
          totalWordsLearned: profile.totalWordsLearned + 1
        });
      }
      setIsAddModalOpen(false);
      setNewWord('');
      addToast(`"${wordData.word}" added to your collection!`);
    } catch (error) {
      addToast('Failed to add word', 'error');
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/words/${wordId}`);
    }
  };

  const handleUpdateWord = async (wordId: string, updates: Partial<Word>) => {
    if (!user) return;
    const wordRef = doc(db, 'users', user.uid, 'words', wordId);
    try {
      await setDoc(wordRef, updates, { merge: true });
      setEditingWord(null);
      if (updates.isStarred !== undefined) {
        addToast(updates.isStarred ? 'Word starred' : 'Word unstarred', 'info');
      } else {
        addToast('Word updated successfully');
      }
    } catch (error) {
      addToast('Failed to update word', 'error');
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/words/${wordId}`);
    }
  };

  const handleDeleteWord = async (wordId: string) => {
    if (!user) return;
    if (!window.confirm('Are you sure you want to delete this word?')) return;
    const wordRef = doc(db, 'users', user.uid, 'words', wordId);
    try {
      await deleteDoc(wordRef);
      addToast('Word deleted');
    } catch (error) {
      addToast('Failed to delete word', 'error');
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/words/${wordId}`);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast('Copied to clipboard!', 'info');
  };

  const handleAiAutoFill = async (word: string) => {
    if (!word) return null;
    setIsAiLoading(true);
    try {
      const info = await getWordInfo(word);
      addToast('AI successfully fetched word info!', 'success');
      return info;
    } catch (error) {
      console.error(error);
      addToast("AI failed to fetch word info. Please try again.", 'error');
      return null;
    } finally {
      setIsAiLoading(false);
    }
  };

  const filteredWords = words
    .filter(w => 
      (w.word.toLowerCase().includes(searchQuery.toLowerCase()) || 
       w.meaning.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (!isStarredOnly || w.isStarred)
    )
    .sort((a, b) => {
      if (sortOrder === 'asc') return a.word.localeCompare(b.word);
      if (sortOrder === 'desc') return b.word.localeCompare(a.word);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const wordsToReview = words.filter(w => new Date(w.nextReview) <= new Date());

  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-24 lg:pb-0 lg:pl-64">
      {/* Sidebar (Desktop) */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-white border-r-2 border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-sm">
            <Brain className="text-white w-6 h-6" />
          </div>
          <span className="text-2xl font-black text-gray-900 tracking-tight">VocaQuest</span>
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard />} label="Dashboard" />
          <NavItem active={activeTab === 'dictionary'} onClick={() => setActiveTab('dictionary')} icon={<Book />} label="Dictionary" />
          <NavItem active={activeTab === 'review'} onClick={() => setActiveTab('review')} icon={<Brain />} label="Review" count={wordsToReview.length} />
          <NavItem active={activeTab === 'leaderboard'} onClick={() => setActiveTab('leaderboard')} icon={<Trophy />} label="Leaderboard" />
          <NavItem active={activeTab === 'quiz'} onClick={() => setActiveTab('quiz')} icon={<Gamepad2 />} label="Quiz" />
          <NavItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings />} label="Settings" />
        </nav>

        <div className="mt-auto pt-6 border-t-2 border-gray-50">
          <button 
            onClick={logout}
            className="flex items-center gap-3 w-full p-4 text-gray-500 font-bold hover:bg-red-50 hover:text-red-600 rounded-2xl transition-all"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-4 lg:p-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <Dashboard 
              profile={profile} 
              words={words} 
              onStartReview={() => setActiveTab('review')}
              onAddWord={() => setIsAddModalOpen(true)}
            />
          )}
          {activeTab === 'dictionary' && (
            <Dictionary 
              words={filteredWords} 
              searchQuery={searchQuery} 
              setSearchQuery={setSearchQuery} 
              onAdd={() => setIsAddModalOpen(true)}
              onEdit={(w) => setEditingWord(w)}
              onDelete={handleDeleteWord}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              isStarredOnly={isStarredOnly}
              setIsStarredOnly={setIsStarredOnly}
              onToggleStar={(id, starred) => handleUpdateWord(id, { isStarred: starred })}
              onCopy={handleCopy}
            />
          )}
          {activeTab === 'review' && (
            <Review 
              words={words} 
              onComplete={() => setActiveTab('dashboard')} 
              onToggleStar={(id, starred) => handleUpdateWord(id, { isStarred: starred })}
            />
          )}
          {activeTab === 'quiz' && <Quiz words={words} />}
          {activeTab === 'leaderboard' && <Leaderboard />}
          {activeTab === 'settings' && <SettingsSection profile={profile} updateProfile={updateProfile} onSaveSuccess={() => addToast('Settings saved successfully!', 'success')} />}
        </AnimatePresence>
      </main>

      {/* Bottom Nav (Mobile) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-100 flex justify-around p-4 z-50">
        <MobileNavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard />} />
        <MobileNavItem active={activeTab === 'dictionary'} onClick={() => setActiveTab('dictionary')} icon={<Book />} />
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg -mt-8 border-4 border-white active:scale-90 transition-transform"
        >
          <Plus className="w-8 h-8" />
        </button>
        <MobileNavItem active={activeTab === 'review'} onClick={() => setActiveTab('review')} icon={<Brain />} count={wordsToReview.length} />
        <MobileNavItem active={activeTab === 'leaderboard'} onClick={() => setActiveTab('leaderboard')} icon={<Trophy />} />
        <MobileNavItem active={activeTab === 'quiz'} onClick={() => setActiveTab('quiz')} icon={<Gamepad2 />} />
        <MobileNavItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings />} />
      </nav>

      {/* Word Modal (Add/Edit) */}
      <WordModal 
        isOpen={isAddModalOpen || !!editingWord}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingWord(null);
        }}
        onSave={editingWord ? (data) => handleUpdateWord(editingWord.id!, data) : handleAddWord}
        initialData={editingWord || { word: newWord }}
        isAiLoading={isAiLoading}
        onAiAutoFill={handleAiAutoFill}
      />
    </div>
  );
};

// --- Sub-Components ---

const NavItem = ({ active, onClick, icon, label, count }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, count?: number }) => (
  <motion.button 
    whileHover={{ x: 4 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={`w-full flex items-center gap-3 p-3 rounded-xl font-semibold transition-all duration-200 group relative ${
      active ? 'bg-brand-50 text-brand-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
    }`}
  >
    <span className={`transition-colors ${active ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
      {React.cloneElement(icon as React.ReactElement, { size: 20 })}
    </span>
    <span className="text-sm">{label}</span>
    {count !== undefined && count > 0 && (
      <span className={`ml-auto px-2 py-0.5 text-[10px] font-bold rounded-full ${
        active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'
      }`}>
        {count}
      </span>
    )}
  </motion.button>
);

const MobileNavItem = ({ active, onClick, icon, count }: { active: boolean, onClick: () => void, icon: React.ReactNode, count?: number }) => (
  <motion.button 
    whileTap={{ scale: 0.9 }}
    onClick={onClick}
    className={`p-3 rounded-xl transition-all relative ${active ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400'}`}
  >
    {icon}
    {count !== undefined && count > 0 && (
      <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full border-2 border-white">{count}</span>
    )}
  </motion.button>
);

const Dashboard = ({ profile, words, onStartReview, onAddWord }: { profile: UserProfile | null, words: Word[], onStartReview: () => void, onAddWord: () => void }) => {
  if (!profile) return null;
  
  const stats = [
    { label: 'Total Words', value: words.length, icon: <Book className="w-5 h-5" />, color: 'bg-blue-50 text-blue-600', trend: '+12% this week' },
    { label: 'Mastered', value: profile.totalWordsMastered, icon: <CheckCircle2 className="w-5 h-5" />, color: 'bg-brand-50 text-brand-600', trend: 'Keep it up!' },
    { label: 'Streak', value: `${profile.streak} days`, icon: <Flame className="w-5 h-5" />, color: 'bg-orange-50 text-orange-600', trend: 'Personal best!' },
    { label: 'Total XP', value: profile.xp, icon: <Trophy className="w-5 h-5" />, color: 'bg-yellow-50 text-yellow-600', trend: 'Level up soon' },
  ];

  const progress = (profile.wordsLearnedToday / profile.dailyGoal) * 100;
  const recentWords = [...words].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3);

  // Mock activity data for the chart
  const activityData = [
    { day: 'M', count: 4 },
    { day: 'T', count: 7 },
    { day: 'W', count: 5 },
    { day: 'T', count: 12 },
    { day: 'F', count: 8 },
    { day: 'S', count: 15 },
    { day: 'S', count: profile.wordsLearnedToday },
  ];
  const maxActivity = Math.max(...activityData.map(d => d.count), 1);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8 pb-12"
    >
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-display font-bold text-slate-900 tracking-tight">
            Hi, {profile.displayName?.split(' ')[0]}! 👋
          </h1>
          <p className="text-slate-500 font-medium text-lg">You've mastered {profile.totalWordsMastered} words so far. Ready for more?</p>
        </div>
        <div className="flex items-center gap-4 bg-white p-3 pr-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50 group hover:border-brand-200 transition-all">
          <div className="w-14 h-14 bg-brand-500 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-brand-100 group-hover:scale-105 transition-transform">
            {profile.displayName?.[0]?.toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-brand-600 uppercase tracking-widest">Level {profile.level}</span>
              <div className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse" />
            </div>
            <div className="text-lg font-bold text-slate-900">{profile.xp % 100} <span className="text-slate-400 text-sm font-medium">/ 100 XP</span></div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          {/* Word of the Day - Recipe 2: Editorial */}
          <motion.div 
            whileHover={{ scale: 1.01 }}
            className="relative h-64 rounded-[3rem] overflow-hidden group shadow-2xl shadow-brand-200/20"
          >
            <img 
              src="https://picsum.photos/seed/vocabulary/1200/600" 
              alt="Word of the Day" 
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
            <div className="absolute bottom-0 left-0 p-8 text-white space-y-2">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/30">
                Word of the Day
              </div>
              <h2 className="text-5xl font-display font-bold tracking-tighter">Resilience</h2>
              <p className="text-slate-200 font-medium max-w-md">The capacity to recover quickly from difficulties; toughness.</p>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <motion.div 
              whileHover={{ y: -4 }}
              className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden group"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="space-y-1">
                  <h2 className="text-2xl font-display font-bold text-slate-900">Daily Progress</h2>
                  <p className="text-sm text-slate-500 font-medium">Goal: {profile.dailyGoal} words</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-display font-bold text-brand-600">{profile.wordsLearnedToday}</div>
                </div>
              </div>
              <div className="h-4 bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-0.5 mb-6">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(progress, 100)}%` }}
                  className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                />
              </div>
              <p className="text-sm text-slate-500 font-medium flex items-center gap-2">
                {progress >= 100 ? (
                  <><CheckCircle2 className="w-4 h-4 text-brand-500" /> Goal achieved!</>
                ) : (
                  <><Zap className="w-4 h-4 text-yellow-500" /> {profile.dailyGoal - profile.wordsLearnedToday} left</>
                )}
              </p>
            </motion.div>

            <motion.div 
              whileHover={{ y: -4 }}
              className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm group"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="space-y-1">
                  <h2 className="text-2xl font-display font-bold text-slate-900">Activity</h2>
                  <p className="text-sm text-slate-500 font-medium">Last 7 days</p>
                </div>
                <BarChart2 className="w-6 h-6 text-slate-300" />
              </div>
              <div className="flex items-end justify-between h-24 gap-2">
                {activityData.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${(d.count / maxActivity) * 100}%` }}
                      className={`w-full rounded-t-lg transition-colors ${i === 6 ? 'bg-brand-500' : 'bg-slate-100 group-hover:bg-slate-200'}`}
                    />
                    <span className="text-[10px] font-bold text-slate-400">{d.day}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>

        <div className="space-y-8">
          <motion.div 
            whileHover={{ scale: 1.02 }}
            className="bg-slate-900 p-8 rounded-[3rem] text-white relative overflow-hidden shadow-2xl shadow-slate-900/20 group"
          >
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 bg-brand-500/20 text-brand-400 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest mb-6 border border-brand-500/30">
                <RefreshCcw className="w-3 h-3 animate-spin-slow" />
                Spaced Repetition
              </div>
              <h3 className="text-3xl font-display font-bold mb-4 leading-tight">Review Time</h3>
              <p className="text-slate-400 font-medium mb-8 text-sm leading-relaxed">Strengthen your memory with our AI-powered sessions.</p>
              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={onStartReview}
                className="w-full bg-brand-500 text-white py-4 rounded-2xl font-bold hover:bg-brand-600 transition-all shadow-xl shadow-brand-500/20 active:scale-95 flex items-center justify-center gap-3 group/btn"
              >
                Start Session
                <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
              </motion.button>
            </div>
            <Brain className="absolute -right-12 -bottom-12 w-64 h-64 text-white/5 rotate-12 group-hover:scale-110 transition-transform duration-700" />
          </motion.div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-display font-bold text-slate-900">Recent</h2>
              <button className="text-xs font-bold text-brand-600 hover:underline">View all</button>
            </div>
            <div className="space-y-3">
              {recentWords.length === 0 ? (
                <div className="p-10 bg-white rounded-[2rem] border-2 border-dashed border-slate-100 text-center">
                  <Book className="w-10 h-10 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold text-sm">No words yet.</p>
                </div>
              ) : (
                recentWords.map((word) => (
                  <motion.div 
                    key={word.id}
                    whileHover={{ x: 4 }}
                    className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                        <Book className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{word.word}</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{word.difficulty}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500 transition-colors" />
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

          <div className="space-y-6">
            <h2 className="text-2xl font-display font-bold text-slate-900">Achievements</h2>
            <div className="grid grid-cols-2 gap-4">
              {profile.achievements.length === 0 ? (
                <div className="col-span-2 p-10 bg-white rounded-[2rem] border-2 border-dashed border-slate-100 text-center">
                  <Trophy className="w-10 h-10 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold text-sm">Unlock your first badge!</p>
                </div>
              ) : (
                profile.achievements.slice(0, 4).map((achievement) => (
                  <motion.div 
                    key={achievement.id}
                    whileHover={{ scale: 1.05, rotate: 2 }}
                    className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center text-center gap-3 group"
                  >
                    <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                      {achievement.icon}
                    </div>
                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-tight">{achievement.title}</h4>
                  </motion.div>
                ))
              )}
            </div>
          </div>

      {/* Quick Add FAB */}
      <motion.button
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        onClick={onAddWord}
        className="fixed bottom-28 right-6 lg:bottom-8 lg:right-8 w-16 h-16 bg-brand-600 text-white rounded-2xl shadow-2xl shadow-brand-500/40 flex items-center justify-center z-50 group"
      >
        <Plus className="w-8 h-8 group-hover:scale-110 transition-transform" />
      </motion.button>
    </motion.div>
  );
};

const AchievementsSection = ({ achievements }: { achievements: Achievement[] }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-black text-gray-900">Achievements</h2>
      <span className="text-sm font-bold text-gray-400">{achievements.length} Unlocked</span>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {achievements.length === 0 ? (
        <div className="col-span-full p-8 bg-white rounded-3xl border-2 border-dashed border-gray-100 text-center">
          <Trophy className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-gray-400 font-bold">No achievements yet. Keep learning!</p>
        </div>
      ) : (
        achievements.map((achievement) => (
          <motion.div 
            key={achievement.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-6 rounded-3xl border-2 border-gray-100 shadow-sm flex items-center gap-4"
          >
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-2xl">
              {achievement.icon}
            </div>
            <div>
              <h4 className="font-black text-gray-900">{achievement.title}</h4>
              <p className="text-xs text-gray-500 font-medium">{achievement.description}</p>
              <p className="text-[10px] text-emerald-500 font-bold mt-1 uppercase tracking-widest">
                Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}
              </p>
            </div>
          </motion.div>
        ))
      )}
    </div>
  </div>
);

const Dictionary = ({ 
  words, 
  searchQuery, 
  setSearchQuery, 
  onAdd, 
  onEdit, 
  onDelete,
  sortOrder,
  setSortOrder,
  isStarredOnly,
  setIsStarredOnly,
  onToggleStar,
  onCopy
}: { 
  words: Word[], 
  searchQuery: string, 
  setSearchQuery: (s: string) => void, 
  onAdd: () => void,
  onEdit: (w: Word) => void,
  onDelete: (id: string) => void,
  sortOrder: 'asc' | 'desc' | 'newest',
  setSortOrder: (o: 'asc' | 'desc' | 'newest') => void,
  isStarredOnly: boolean,
  setIsStarredOnly: (b: boolean) => void,
  onToggleStar: (id: string, starred: boolean) => void,
  onCopy: (text: string) => void
}) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, x: -20 }}
    className="space-y-8"
  >
    <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div className="space-y-1">
        <h1 className="text-4xl font-display font-bold text-slate-900 tracking-tight">Dictionary</h1>
        <p className="text-slate-500 font-medium">Manage and explore your vocabulary collection.</p>
      </div>
      <button 
        onClick={onAdd}
        className="bg-brand-600 text-white px-8 py-4 rounded-2xl font-bold shadow-xl shadow-brand-100 hover:bg-brand-700 transition-all active:scale-95 flex items-center gap-3"
      >
        <Plus className="w-6 h-6" />
        Add New Word
      </button>
    </header>

    <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-3 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40">
      <div className="relative flex-1 w-full">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search words or meanings..."
          className="w-full bg-slate-50 border-none rounded-2xl pl-14 pr-4 py-4 font-medium text-slate-900 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition-all"
        />
      </div>
      <div className="flex items-center gap-3 w-full md:w-auto">
        <button
          onClick={() => setIsStarredOnly(!isStarredOnly)}
          className={`px-6 py-4 rounded-2xl border-2 font-bold text-sm transition-all flex items-center gap-2 ${
            isStarredOnly ? 'bg-yellow-50 border-yellow-200 text-yellow-600' : 'bg-white border-slate-100 text-slate-400 hover:border-yellow-200'
          }`}
        >
          <Star className={`w-4 h-4 ${isStarredOnly ? 'fill-current' : ''}`} />
          Starred
        </button>
        <div className="relative flex-1 md:flex-none">
          <select 
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="w-full bg-white border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold text-sm text-slate-700 focus:border-brand-500 focus:outline-none transition-all appearance-none cursor-pointer pr-12"
          >
            <option value="newest">Newest First</option>
            <option value="asc">A-Z (Ascending)</option>
            <option value="desc">Z-A (Descending)</option>
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>
    </div>

    <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
      {/* Header Row - Recipe 1 */}
      <div className="grid grid-cols-[1fr_2fr_1fr_1fr_100px] border-bottom border-slate-200 bg-slate-50/50">
        <div className="p-4 text-[11px] font-serif italic uppercase tracking-wider text-slate-400 border-r border-slate-200">Word</div>
        <div className="p-4 text-[11px] font-serif italic uppercase tracking-wider text-slate-400 border-r border-slate-200">Meaning</div>
        <div className="p-4 text-[11px] font-serif italic uppercase tracking-wider text-slate-400 border-r border-slate-200">Difficulty</div>
        <div className="p-4 text-[11px] font-serif italic uppercase tracking-wider text-slate-400 border-r border-slate-200">Status</div>
        <div className="p-4 text-[11px] font-serif italic uppercase tracking-wider text-slate-400">Actions</div>
      </div>

      {words.length === 0 ? (
        <div className="py-32 text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Book className="w-10 h-10 text-slate-200" />
          </div>
          <h3 className="text-xl font-display font-bold text-slate-900 mb-2">No words found</h3>
          <p className="text-slate-400 font-medium max-w-xs mx-auto">Try adjusting your search or add a new word.</p>
        </div>
      ) : (
        <motion.div 
          className="divide-y divide-slate-100"
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.05 } }
          }}
        >
          {words.map((word) => (
            <motion.div 
              layout
              key={word.id}
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0 }
              }}
              whileHover={{ scale: 1.002, x: 4, backgroundColor: "rgba(15, 23, 42, 1)", color: "rgba(255, 255, 255, 1)" }}
              whileTap={{ scale: 0.998 }}
              className="grid grid-cols-[1fr_2fr_1fr_1fr_100px] border-b border-slate-100 transition-all group cursor-pointer"
            >
              <div className="p-6 border-r border-slate-100 group-hover:border-slate-800 flex items-center gap-3">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleStar(word.id!, !word.isStarred);
                  }}
                  className={`transition-colors ${word.isStarred ? 'text-yellow-500' : 'text-slate-300 group-hover:text-slate-600'}`}
                >
                  <Star className={`w-4 h-4 ${word.isStarred ? 'fill-current' : ''}`} />
                </button>
                <span className="text-lg font-display font-bold tracking-tight">{word.word}</span>
              </div>
              
              <div className="p-6 border-r border-slate-100 group-hover:border-slate-800 flex items-center">
                <p className="text-sm font-medium line-clamp-2 opacity-80">{word.meaning}</p>
              </div>

              <div className="p-6 border-r border-slate-100 group-hover:border-slate-800 flex items-center">
                <span className={`font-mono text-[10px] uppercase tracking-widest px-3 py-1 rounded-full border ${
                  word.difficulty === 'hard' ? 'border-red-200 bg-red-50 text-red-600 group-hover:bg-red-900 group-hover:text-red-100 group-hover:border-red-800' : 
                  word.difficulty === 'medium' ? 'border-orange-200 bg-orange-50 text-orange-600 group-hover:bg-orange-900 group-hover:text-orange-100 group-hover:border-orange-800' : 
                  'border-brand-200 bg-brand-50 text-brand-600 group-hover:bg-brand-900 group-hover:text-brand-100 group-hover:border-brand-800'
                }`}>
                  {word.difficulty}
                </span>
              </div>

              <div className="p-6 border-r border-slate-100 group-hover:border-slate-800 flex items-center">
                <span className={`font-mono text-[10px] uppercase tracking-widest px-3 py-1 rounded-full border ${
                  word.status === 'mastered' ? 'border-brand-500 bg-brand-500 text-white' : 
                  word.status === 'learning' ? 'border-blue-500 bg-blue-500 text-white' : 
                  'border-slate-200 bg-slate-100 text-slate-600 group-hover:bg-slate-800 group-hover:text-slate-400 group-hover:border-slate-700'
                }`}>
                  {word.status}
                </span>
              </div>

              <div className="p-6 flex items-center justify-center gap-2">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(word);
                  }}
                  className="p-2 text-slate-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-all group-hover:hover:bg-brand-900"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(word.id!);
                  }}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all group-hover:hover:bg-red-900"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  </motion.div>
);

const Review = ({ words, onComplete, onToggleStar }: { words: Word[], onComplete: () => void, onToggleStar: (id: string, starred: boolean) => void }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [mode, setMode] = useState<'meaning' | 'synonyms' | 'antonyms' | 'recall' | 'antonym-recall' | null>(null);
  const [filter, setFilter] = useState<'due' | 'starred' | 'all'>('due');
  const [recallInput, setRecallInput] = useState('');
  const [recallFeedback, setRecallFeedback] = useState<'correct' | 'wrong' | null>(null);
  const { user, profile, updateProfile } = useAuth();

  const filteredWords = words.filter(w => {
    if (filter === 'due') return new Date(w.nextReview) <= new Date();
    if (filter === 'starred') return w.isStarred;
    return true;
  });

  const colorMap: Record<string, { bg: string, border: string, text: string, iconBg: string }> = {
    emerald: { bg: 'bg-brand-50', border: 'border-brand-100', text: 'text-brand-700', iconBg: 'bg-brand-100' },
    yellow: { bg: 'bg-yellow-50', border: 'border-yellow-100', text: 'text-yellow-700', iconBg: 'bg-yellow-100' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700', iconBg: 'bg-blue-100' }
  };

  if (!mode) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto space-y-12 py-8"
      >
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-brand-100 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-inner shadow-brand-200/50">
            <Brain className="text-brand-600 w-10 h-10" />
          </div>
          <h2 className="text-4xl font-display font-bold text-slate-900 tracking-tight">Review Session</h2>
          <p className="text-slate-500 font-medium text-lg">Choose your focus for this session.</p>
        </div>

        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {([
              { id: 'due', label: 'Due for Review', icon: <Calendar className="w-5 h-5" />, count: words.filter(w => new Date(w.nextReview) <= new Date()).length, color: 'emerald' },
              { id: 'starred', label: 'Starred Words', icon: <Star className="w-5 h-5" />, count: words.filter(w => w.isStarred).length, color: 'yellow' },
              { id: 'all', label: 'All Words', icon: <Book className="w-5 h-5" />, count: words.length, color: 'blue' },
            ] as const).map((f) => (
              <motion.button
                key={f.id}
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setFilter(f.id)}
                className={`p-6 rounded-3xl border transition-all duration-300 flex flex-col items-start gap-4 group ${
                  filter === f.id 
                    ? `${colorMap[f.color].bg} ${colorMap[f.color].border} ${colorMap[f.color].text} shadow-lg shadow-slate-200/50` 
                    : 'bg-white border-slate-100 text-slate-600 hover:border-brand-200 hover:bg-slate-50'
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                  filter === f.id ? colorMap[f.color].iconBg : 'bg-slate-50 group-hover:bg-white'
                }`}>
                  {f.icon}
                </div>
                <div>
                  <h4 className="font-bold text-sm tracking-tight">{f.label}</h4>
                  <p className="text-xs font-bold opacity-60 uppercase tracking-widest mt-1">{f.count} words</p>
                </div>
              </motion.button>
            ))}
          </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {([
            { id: 'meaning', label: 'Meaning', icon: <Book className="w-6 h-6" />, desc: 'Test definitions' },
            { id: 'synonyms', label: 'Synonyms', icon: <Layers className="w-6 h-6" />, desc: 'Standard flashcards' },
            { id: 'recall', label: 'Synonym Recall', icon: <RefreshCcw className="w-6 h-6" />, desc: 'Type synonyms' },
            { id: 'antonyms', label: 'Antonyms', icon: <ArrowLeftRight className="w-6 h-6" />, desc: 'Test opposites' },
            { id: 'antonym-recall', label: 'Antonym Recall', icon: <RefreshCcw className="w-6 h-6" />, desc: 'Type antonyms' },
          ] as const).map((m) => (
            <motion.button
              key={m.id}
              whileHover={{ y: -8, scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setMode(m.id);
                setRecallInput('');
                setRecallFeedback(null);
              }}
              disabled={filteredWords.length === 0}
              className="p-8 bg-white rounded-[2rem] border border-slate-100 hover:border-brand-500 hover:shadow-2xl hover:shadow-brand-100/50 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-600 mb-6 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
                  {m.icon}
                </div>
                <h4 className="text-xl font-display font-bold text-slate-900 mb-2">{m.label}</h4>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">{m.desc}</p>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  if (filteredWords.length === 0 || showResult) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl mx-auto text-center py-20 bg-white rounded-[3rem] border border-slate-100 shadow-2xl shadow-slate-200/50"
      >
        <div className="w-24 h-24 bg-brand-100 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner shadow-brand-200/50">
          <Trophy className="text-brand-600 w-12 h-12" />
        </div>
        <h2 className="text-4xl font-display font-bold text-slate-900 mb-4">Review Complete!</h2>
        <p className="text-slate-500 font-medium text-lg mb-10 max-w-sm mx-auto">You've strengthened your memory for {filteredWords.length} words today.</p>
        <button 
          onClick={onComplete}
          className="bg-brand-600 text-white px-12 py-4 rounded-2xl font-bold shadow-xl shadow-brand-200/50 hover:bg-brand-700 transition-all active:scale-95 text-lg"
        >
          Back to Dashboard
        </button>
      </motion.div>
    );
  }

  const currentWord = filteredWords[currentIndex];

  const handleReview = async (quality: number) => {
    if (!user || !profile) return;
    
    // Refined SM-2 Spaced Repetition Logic
    let newInterval: number;
    let newRepetition: number;
    let newEaseFactor: number;

    if (quality >= 3) {
      // Success: Correct response
      if (currentWord.repetition === 0) {
        newInterval = 1;
        newRepetition = 1;
      } else if (currentWord.repetition === 1) {
        newInterval = 6;
        newRepetition = 2;
      } else {
        // Standard SM-2 interval formula: I(n) = I(n-1) * EF
        // We add a small bonus for "Easy" (quality 5)
        const bonus = quality === 5 ? 1.15 : 1.0;
        newInterval = Math.round(currentWord.interval * currentWord.easeFactor * bonus);
        newRepetition = currentWord.repetition + 1;
      }

      // SM-2 Ease Factor formula: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
      newEaseFactor = currentWord.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
      newEaseFactor = Math.max(1.3, newEaseFactor);
    } else {
      // Failure: Incorrect response
      newRepetition = 0;
      newInterval = 1;
      newEaseFactor = currentWord.easeFactor; // EF remains unchanged on failure in standard SM-2
    }

    // Ensure interval is at least 1 day
    newInterval = Math.max(1, newInterval);

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

    const wordRef = doc(db, 'users', user.uid, 'words', currentWord.id!);
    const isMastered = newInterval > 14;
    const wasMastered = currentWord.status === 'mastered';

    try {
      await setDoc(wordRef, {
        ...currentWord,
        interval: newInterval,
        repetition: newRepetition,
        easeFactor: newEaseFactor,
        nextReview: nextReviewDate.toISOString(),
        status: isMastered ? 'mastered' : 'learning'
      }, { merge: true });

      // Update Profile Stats: XP and Mastery
      const xpGain = quality === 5 ? 15 : (quality >= 3 ? 10 : 2);
      const updates: any = {
        xp: profile.xp + xpGain
      };

      if (isMastered && !wasMastered) {
        updates.totalWordsMastered = profile.totalWordsMastered + 1;
      }

      await updateProfile(updates);

      if (currentIndex < filteredWords.length - 1) {
        setIsFlipped(false);
        setRecallInput('');
        setRecallFeedback(null);
        setCurrentIndex(currentIndex + 1);
      } else {
        setShowResult(true);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/words/${currentWord.id}`);
    }
  };

  const handleRecallCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recallInput.trim()) return;
    
    const listToCheck = mode === 'recall' ? currentWord.synonyms : (mode === 'antonym-recall' ? currentWord.antonyms : []);
    const isCorrect = listToCheck.some(s => 
      s.toLowerCase().trim() === recallInput.toLowerCase().trim()
    );
    
    setRecallFeedback(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) {
      setTimeout(() => setIsFlipped(true), 1000);
    }
  };

  const renderBackContent = () => {
    switch (mode) {
      case 'meaning':
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <span className="text-xs font-bold text-brand-500 uppercase tracking-[0.2em] mb-6">Meaning</span>
            <p className="text-2xl font-display font-bold text-slate-800 leading-relaxed max-w-md">{currentWord.meaning}</p>
            {currentWord.exampleSentence && (
              <div className="mt-8 p-4 bg-slate-50 rounded-2xl border border-slate-100 max-w-sm">
                <p className="text-sm text-slate-500 italic">"{currentWord.exampleSentence}"</p>
              </div>
            )}
          </div>
        );
      case 'synonyms':
      case 'recall':
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <span className="text-xs font-bold text-brand-500 uppercase tracking-[0.2em] mb-8">Synonyms</span>
            <div className="flex flex-wrap justify-center gap-3 max-w-md">
              {currentWord.synonyms.length > 0 ? (
                currentWord.synonyms.map((s, i) => (
                  <span key={i} className="text-lg font-bold text-brand-600 bg-brand-50 px-5 py-2.5 rounded-2xl border border-brand-100 shadow-sm">#{s}</span>
                ))
              ) : (
                <p className="text-slate-400 font-bold">No synonyms recorded</p>
              )}
            </div>
          </div>
        );
      case 'antonyms':
      case 'antonym-recall':
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <span className="text-xs font-bold text-brand-500 uppercase tracking-[0.2em] mb-8">Antonyms</span>
            <div className="flex flex-wrap justify-center gap-3 max-w-md">
              {currentWord.antonyms.length > 0 ? (
                currentWord.antonyms.map((s, i) => (
                  <span key={i} className="text-lg font-bold text-red-600 bg-red-50 px-5 py-2.5 rounded-2xl border border-red-100 shadow-sm">#{s}</span>
                ))
              ) : (
                <p className="text-slate-400 font-bold">No antonyms recorded</p>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="relative min-h-[80vh] flex flex-col items-center justify-center py-12 px-4 overflow-hidden rounded-[4rem]">
      {/* Atmospheric Background - Recipe 7 */}
      <div className="absolute inset-0 -z-10 bg-slate-50">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-400/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-400/20 blur-[120px] rounded-full animate-pulse delay-700" />
      </div>

      <div className="w-full max-w-3xl space-y-10 relative z-10">
        <div className="flex items-center justify-between gap-6">
          <button 
            onClick={() => setMode(null)} 
            className="p-3 bg-white/50 backdrop-blur-md border border-white/50 text-slate-400 hover:text-slate-600 hover:bg-white rounded-2xl transition-all shadow-sm"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 h-3 bg-white/50 backdrop-blur-md rounded-full overflow-hidden shadow-inner border border-white/50">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${((currentIndex + 1) / filteredWords.length) * 100}%` }}
              className="h-full bg-gradient-to-r from-brand-400 to-brand-600 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
            />
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => onToggleStar(currentWord.id!, !currentWord.isStarred)}
              className={`p-3 rounded-2xl transition-all shadow-sm border border-white/50 ${
                currentWord.isStarred ? 'text-yellow-500 bg-yellow-50' : 'text-slate-300 bg-white/50 hover:text-yellow-500 hover:bg-white'
              }`}
            >
              <Star className={`w-5 h-5 ${currentWord.isStarred ? 'fill-current' : ''}`} />
            </button>
            <span className="text-sm font-black text-slate-400 uppercase tracking-widest tabular-nums">{currentIndex + 1} / {filteredWords.length}</span>
          </div>
        </div>

        <div className="perspective-1000 h-[450px] w-full group">
          <motion.div 
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="w-full h-full relative preserve-3d cursor-pointer"
            onClick={() => !isFlipped && setIsFlipped(true)}
          >
            {/* Front Side */}
            <div className="absolute inset-0 backface-hidden bg-white/80 backdrop-blur-xl border-2 border-white rounded-[3.5rem] shadow-2xl shadow-slate-200/50 flex flex-col items-center justify-center p-12 text-center group-hover:border-brand-200 transition-colors">
              <div className="absolute top-8 right-8">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-2 border-slate-100 px-4 py-1.5 rounded-full">{currentWord.difficulty}</span>
              </div>
              
              <span className="text-xs font-black text-brand-500 uppercase tracking-[0.3em] mb-6">Word</span>
              <motion.h2 
                layoutId={`word-${currentWord.id}`}
                className="text-7xl font-display font-bold text-slate-900 tracking-tighter mb-8"
              >
                {currentWord.word}
              </motion.h2>
              
              {(mode === 'recall' || mode === 'antonym-recall') && !isFlipped ? (
                <form onSubmit={handleRecallCheck} className="w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={recallInput}
                      onChange={(e) => setRecallInput(e.target.value)}
                      placeholder={mode === 'recall' ? "Type a synonym..." : "Type an antonym..."}
                      className={`w-full bg-slate-50 border-2 px-6 py-4 rounded-2xl font-bold text-center transition-all focus:outline-none focus:ring-4 focus:ring-brand-500/10 ${
                        recallFeedback === 'correct' ? 'border-brand-500 bg-brand-50 text-brand-700' : 
                        recallFeedback === 'wrong' ? 'border-red-500 bg-red-50 text-red-700' : 
                        'border-slate-100 focus:border-brand-500'
                      }`}
                    />
                    <AnimatePresence>
                      {recallFeedback && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.5 }}
                          className="absolute -right-12 top-1/2 -translate-y-1/2"
                        >
                          {recallFeedback === 'correct' ? (
                            <div className="w-10 h-10 bg-brand-500 rounded-full flex items-center justify-center text-white shadow-lg">
                              <CheckCircle2 className="w-6 h-6" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg">
                              <X className="w-6 h-6" />
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <motion.button 
                    whileTap={{ scale: 0.98 }}
                    type="submit" 
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200"
                  >
                    Check Answer
                  </motion.button>
                </form>
              ) : (
                <div className="flex items-center gap-3 text-slate-400 font-bold bg-slate-50 px-6 py-3 rounded-full border border-slate-100">
                  <RotateCcw className="w-5 h-5" />
                  <span className="text-xs uppercase tracking-[0.2em]">Tap to flip</span>
                </div>
              )}
            </div>

            {/* Back Side */}
            <div className="absolute inset-0 backface-hidden rotate-y-180 bg-slate-900 rounded-[3.5rem] shadow-2xl shadow-slate-900/40 flex flex-col items-center justify-center p-12 text-center text-white overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 blur-[100px] rounded-full" />
              <div className="relative z-10 w-full">
                {renderBackContent()}
              </div>
            </div>
          </motion.div>
        </div>

        <AnimatePresence>
          {isFlipped && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-center gap-4"
            >
              {([
                { q: 1, label: 'Again', color: 'bg-red-500 hover:bg-red-600', desc: 'Forgot' },
                { q: 3, label: 'Hard', color: 'bg-orange-500 hover:bg-orange-600', desc: 'Struggled' },
                { q: 4, label: 'Good', color: 'bg-blue-500 hover:bg-blue-600', desc: 'Recalled' },
                { q: 5, label: 'Easy', color: 'bg-brand-500 hover:bg-brand-600', desc: 'Perfect' },
              ] as const).map((btn) => (
                <motion.button
                  key={btn.q}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleReview(btn.q)}
                  className={`${btn.color} text-white px-10 py-5 rounded-[2rem] font-bold shadow-xl transition-all active:scale-95 flex flex-col items-center group min-w-[120px]`}
                >
                  <span className="text-lg">{btn.label}</span>
                  <span className="text-[10px] opacity-60 uppercase tracking-widest mt-0.5">{btn.desc}</span>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const Quiz = ({ words }: { words: Word[] }) => {
  const [quizStarted, setQuizStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [showFeedback, setShowFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [questions, setQuestions] = useState<{ word: string, options: string[], correct: string }[]>([]);

  const startQuiz = () => {
    if (words.length < 4) return;
    const shuffled = [...words].sort(() => 0.5 - Math.random());
    const quizQuestions = shuffled.slice(0, 10).map(word => {
      const others = words.filter(w => w.id !== word.id).sort(() => 0.5 - Math.random()).slice(0, 3);
      const options = [word.meaning, ...others.map(o => o.meaning)].sort(() => 0.5 - Math.random());
      return { word: word.word, options, correct: word.meaning };
    });
    setQuestions(quizQuestions);
    setQuizStarted(true);
    setCurrentQuestion(0);
    setScore(0);
  };

  const handleAnswer = (option: string) => {
    if (showFeedback) return;
    if (option === questions[currentQuestion].correct) {
      setScore(score + 1);
      setShowFeedback('correct');
    } else {
      setShowFeedback('wrong');
    }

    setTimeout(() => {
      setShowFeedback(null);
      if (currentQuestion < questions.length - 1) {
        setCurrentQuestion(currentQuestion + 1);
      } else {
        setQuizStarted(false);
        alert(`Quiz Finished! Your score: ${score + (option === questions[currentQuestion].correct ? 1 : 0)}/${questions.length}`);
      }
    }, 1500);
  };

  if (!quizStarted) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto text-center py-20 bg-white rounded-[3rem] border border-slate-100 shadow-2xl shadow-slate-200/50"
      >
        <div className="w-24 h-24 bg-purple-100 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner shadow-purple-200/50 rotate-12">
          <Gamepad2 className="text-purple-600 w-12 h-12" />
        </div>
        <h2 className="text-4xl font-display font-bold text-slate-900 mb-4 tracking-tight">Vocabulary Challenge</h2>
        <p className="text-slate-500 font-medium text-lg mb-10 max-w-sm mx-auto leading-relaxed">Test your knowledge with 10 random words from your personal dictionary.</p>
        <button 
          onClick={startQuiz}
          disabled={words.length < 4}
          className="bg-purple-600 text-white px-12 py-4 rounded-2xl font-bold shadow-xl shadow-purple-200/50 hover:bg-purple-700 transition-all active:scale-95 disabled:opacity-50 text-lg"
        >
          {words.length < 4 ? 'Need at least 4 words' : 'Start Quiz'}
        </button>
      </motion.div>
    );
  }

  const question = questions[currentQuestion];

  return (
    <div className="max-w-4xl mx-auto space-y-12 py-8">
      {/* Brutalist Header - Recipe 5 */}
      <div className="flex items-end justify-between border-b-4 border-black pb-8">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-600 mb-2 block">Vocabulary Challenge</span>
          <h2 className="text-8xl font-display font-black tracking-tighter text-black leading-none">
            {currentQuestion + 1 < 10 ? `0${currentQuestion + 1}` : currentQuestion + 1}
          </h2>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2 block">Progress</span>
          <div className="flex gap-1">
            {questions.map((_, i) => (
              <div 
                key={i} 
                className={`w-3 h-8 border-2 border-black transition-all ${
                  i < currentQuestion ? 'bg-purple-600' : 
                  i === currentQuestion ? 'bg-yellow-400 animate-pulse' : 'bg-white'
                }`} 
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-12 items-start">
        <div className="space-y-12">
          <div className="relative">
            <div className="absolute -top-6 -left-6 w-24 h-24 bg-yellow-400 -z-10 border-4 border-black rotate-6" />
            <div className="bg-white border-4 border-black p-12 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-6 block">What is the meaning of:</span>
              <h3 className="text-6xl font-display font-black tracking-tight text-black mb-4">{question.word}</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {question.options.map((option, i) => (
              <button
                key={i}
                onClick={() => handleAnswer(option)}
                className={`group relative p-8 border-4 border-black text-left transition-all active:translate-x-1 active:translate-y-1 active:shadow-none ${
                  showFeedback === 'correct' && option === question.correct
                    ? 'bg-brand-500 text-white shadow-none translate-x-1 translate-y-1'
                    : showFeedback === 'wrong' && option !== question.correct
                    ? 'bg-red-500 text-white shadow-none translate-x-1 translate-y-1'
                    : 'bg-white hover:bg-yellow-400 text-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]'
                }`}
              >
                <div className="flex items-center gap-6">
                  <span className="text-2xl font-display font-black opacity-20 group-hover:opacity-100 transition-opacity">0{i + 1}</span>
                  <span className="text-xl font-bold tracking-tight">{option}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <aside className="sticky top-8 space-y-8">
          <div className="bg-purple-600 border-4 border-black p-8 text-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-4 block">Current Score</span>
            <div className="text-6xl font-display font-black leading-none">{score}</div>
            <div className="mt-4 h-2 bg-black/20 rounded-full overflow-hidden">
              <div className="h-full bg-white" style={{ width: `${(score / questions.length) * 100}%` }} />
            </div>
          </div>

          <AnimatePresence>
            {showFeedback && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.8, rotate: 5 }}
                className={`p-8 border-4 border-black text-center font-black text-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ${
                  showFeedback === 'correct' ? 'bg-brand-500 text-white' : 'bg-red-500 text-white'
                }`}
              >
                {showFeedback === 'correct' ? 'BOOM! CORRECT' : 'NOPE! TRY AGAIN'}
              </motion.div>
            )}
          </AnimatePresence>
        </aside>
      </div>
    </div>
  );
};

const Leaderboard = () => {
  const [topUsers, setTopUsers] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    const publicRef = collection(db, 'users_public');
    const q = query(publicRef, orderBy('xp', 'desc'), limit(10));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => doc.data() as PublicProfile);
      setTopUsers(users);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users_public');
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <header>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Leaderboard</h1>
        <p className="text-gray-500 font-medium">Top 10 VocaQuest champions</p>
      </header>

      <div className="bg-white rounded-3xl border-2 border-gray-100 shadow-sm overflow-hidden">
        {topUsers.map((user, index) => (
          <div 
            key={user.uid} 
            className={`flex items-center gap-4 p-6 border-b-2 border-gray-50 last:border-b-0 ${
              user.uid === currentUser?.uid ? 'bg-emerald-50' : ''
            }`}
          >
            <div className="w-8 text-center font-black text-gray-400">
              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
            </div>
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 border-2 border-white shadow-sm">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-emerald-100 text-emerald-600 font-bold">
                  {user.displayName?.charAt(0) || '?'}
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="font-bold text-gray-900 flex items-center gap-2">
                {user.displayName || 'Anonymous'}
                {user.uid === currentUser?.uid && (
                  <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase">You</span>
                )}
              </div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Level {user.level} • {user.streak} Day Streak • {user.achievements?.length || 0} Badges
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-black text-emerald-600">{user.xp}</div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">XP</div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

const SettingsSection = ({ profile, updateProfile, onSaveSuccess }: { profile: UserProfile | null, updateProfile: (updates: Partial<UserProfile>) => Promise<void>, onSaveSuccess: () => void }) => {
  const [dailyGoal, setDailyGoal] = useState(profile?.dailyGoal || 10);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile?.dailyGoal) {
      setDailyGoal(profile.dailyGoal);
    }
  }, [profile?.dailyGoal]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProfile({ dailyGoal });
      onSaveSuccess();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8 max-w-2xl mx-auto"
    >
      <header>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Settings</h1>
        <p className="text-gray-500 font-medium">Customize your VocaQuest experience</p>
      </header>

      <div className="bg-white p-8 rounded-[3rem] border-2 border-gray-100 shadow-sm space-y-8">
        <div className="space-y-4">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-display font-bold text-slate-900">Daily Goal</h3>
              <p className="text-sm text-slate-500 font-medium">How many new words do you want to learn each day?</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100">
            <input 
              type="range" 
              min="1" 
              max="50" 
              value={dailyGoal} 
              onChange={(e) => setDailyGoal(parseInt(e.target.value))}
              className="flex-1 accent-emerald-500 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="w-20 text-center">
              <span className="text-3xl font-display font-bold text-emerald-600">{dailyGoal}</span>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Words</p>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-50">
          <button 
            onClick={handleSave}
            disabled={isSaving || dailyGoal === profile?.dailyGoal}
            className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            Save Settings
          </button>
        </div>
      </div>

      <div className="bg-slate-900 p-8 rounded-[3rem] text-white relative overflow-hidden group">
        <div className="relative z-10">
          <h3 className="text-xl font-display font-bold mb-2">Account Information</h3>
          <div className="space-y-2 text-slate-400 text-sm font-medium">
            <p>Email: {profile?.email}</p>
            <p>User ID: {profile?.uid}</p>
          </div>
        </div>
        <Settings className="absolute -right-8 -bottom-8 w-40 h-40 text-white/5 rotate-12 group-hover:rotate-45 transition-transform duration-1000" />
      </div>
    </motion.div>
  );
};

// --- Root App ---

const WordModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialData, 
  isAiLoading, 
  onAiAutoFill 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onSave: (data: Partial<Word>) => Promise<void>,
  initialData: Partial<Word>,
  isAiLoading: boolean,
  onAiAutoFill: (word: string) => Promise<any>
}) => {
  const [formData, setFormData] = useState<Partial<Word>>({
    word: '',
    meaning: '',
    exampleSentence: '',
    difficulty: 'medium',
    synonyms: [],
    antonyms: [],
    isStarred: false,
    ...initialData
  });

  useEffect(() => {
    setFormData({
      word: '',
      meaning: '',
      exampleSentence: '',
      difficulty: 'medium',
      synonyms: [],
      antonyms: [],
      isStarred: false,
      ...initialData
    });
  }, [initialData]);

  const handleAiFill = async () => {
    if (!formData.word) return;
    const info = await onAiAutoFill(formData.word);
    if (info) {
      setFormData({ ...formData, ...info });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-white w-full max-w-2xl rounded-3xl p-8 shadow-2xl my-8"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-black text-gray-900">
                  {initialData.id ? 'Edit Word' : 'Add New Word'}
                </h2>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isStarred: !formData.isStarred })}
                  className={`p-2 rounded-xl transition-all ${
                    formData.isStarred ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-50 text-gray-300 hover:text-yellow-500'
                  }`}
                >
                  <Star className={`w-5 h-5 ${formData.isStarred ? 'fill-current' : ''}`} />
                </button>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Word</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        required
                        value={formData.word || ''}
                        onChange={(e) => setFormData({ ...formData, word: e.target.value })}
                        placeholder="Enter word..."
                        className="flex-1 bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:border-emerald-500 focus:outline-none transition-colors"
                      />
                      <button 
                        type="button"
                        onClick={handleAiFill}
                        disabled={!formData.word || isAiLoading}
                        className="bg-emerald-500 text-white p-3 rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all disabled:opacity-50"
                      >
                        {isAiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Star className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Meaning</label>
                    <textarea 
                      required
                      value={formData.meaning || ''}
                      onChange={(e) => setFormData({ ...formData, meaning: e.target.value })}
                      placeholder="Enter meaning..."
                      rows={3}
                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:border-emerald-500 focus:outline-none transition-colors resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Example Sentence</label>
                    <textarea 
                      value={formData.exampleSentence || ''}
                      onChange={(e) => setFormData({ ...formData, exampleSentence: e.target.value })}
                      placeholder="Use it in a sentence..."
                      rows={2}
                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:border-emerald-500 focus:outline-none transition-colors resize-none"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Difficulty</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['easy', 'medium', 'hard'] as const).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setFormData({ ...formData, difficulty: d })}
                          className={`py-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-all border-2 ${
                            formData.difficulty === d 
                              ? 'bg-emerald-500 border-emerald-500 text-white shadow-md' 
                              : 'bg-white border-gray-100 text-gray-400 hover:border-emerald-200'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Synonyms (comma separated)</label>
                    <input 
                      type="text" 
                      value={formData.synonyms?.join(', ') || ''}
                      onChange={(e) => setFormData({ ...formData, synonyms: e.target.value.split(',').map(s => s.trim()).filter(s => s) })}
                      placeholder="e.g. happy, joyful"
                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:border-emerald-500 focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Antonyms (comma separated)</label>
                    <input 
                      type="text" 
                      value={formData.antonyms?.join(', ') || ''}
                      onChange={(e) => setFormData({ ...formData, antonyms: e.target.value.split(',').map(s => s.trim()).filter(s => s) })}
                      placeholder="e.g. sad, unhappy"
                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-3 font-bold text-gray-900 focus:border-emerald-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-gray-50 text-gray-500 py-4 rounded-2xl font-black hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-emerald-500 text-white py-4 rounded-2xl font-black shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all active:scale-95"
                >
                  {initialData.id ? 'Save Changes' : 'Add Word'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const AppContent = () => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <LoginScreen />;

  return <MainApp />;
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
