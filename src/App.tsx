import { useState, useRef, type ChangeEvent, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Camera, ChefHat, Sparkles, UtensilsCrossed, RefreshCcw, 
  CheckCircle2, ChevronRight, Info, X,
  Moon, Sun, Heart, Share2, Home, 
  Plus, Star, Clock, LogOut, User as UserIcon, Bookmark, BookmarkCheck,
  Image as ImageIcon, Mic, MicOff, RotateCcw
} from "lucide-react";
import { 
  analyzeFridgeImage, 
  analyzeIngredientsText, 
  generateRecipeImage,
  getIngredientSubstitute,
  customizeRecipe,
  type AnalysisResponse, 
  type Recipe,
  type RecipeStep
} from "./lib/gemini";
import { AuthScreen } from "./components/AuthScreen";
import { auth } from "./lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [authStatus, setAuthStatus] = useState<"loading" | "unauthenticated" | "authenticated">("loading");
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [favorites, setFavorites] = useState<Recipe[]>([]);
  const [view, setView] = useState<"home" | "collection" | "admin">("home");
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [adminData, setAdminData] = useState<{ users: any[], feedback: any[] } | null>(null);
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [dietaryGoal, setDietaryGoal] = useState<string>("Balanced");

  const DIETARY_GOALS = [
    { name: "Balanced", icon: <UtensilsCrossed size={14} />, desc: "Wholesome meals" },
    { name: "Weight Loss", icon: <ChevronRight size={14} className="-rotate-90" />, desc: "Low calorie options" },
    { name: "Muscle Gain", icon: <Plus size={14} />, desc: "High protein focus" }
  ];

  const handleQuickCookNow = async () => {
    if (!isOnline) {
      setError("Arre! You are offline. AI Chef needs internet to invent new recipes.");
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    try {
      // If we have an image, use it, otherwise use a generic 'fridge ingredients' prompt
      const prompt = image ? "suggest something and cook it now" : "suggest a quick recipe with common fridge items like vegetables, eggs, and milk";
      const data = await analyzeIngredientsText(prompt, dietaryGoal);
      setResult(data);
      setTimeout(() => setShowRatingModal(true), 1500);
    } catch (err) {
      console.error(err);
      setError("AI was too busy cooking! Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const isAdmin = user?.email === "jeevanshevgan13@gmail.com";

  const fetchAdminData = async () => {
    if (!isAdmin || !auth.currentUser) return;
    setLoadingAdmin(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const [uRes, fRes] = await Promise.all([
        fetch(`${window.location.origin}/api/admin/export-users`, { headers: { "Authorization": `Bearer ${token}` } }),
        fetch(`${window.location.origin}/api/admin/export-feedback`, { headers: { "Authorization": `Bearer ${token}` } })
      ]);
      if (uRes.ok && fRes.ok) {
        setAdminData({
          users: await uRes.json(),
          feedback: await fRes.json()
        });
      }
    } catch (e) {
      console.error("Admin fetch failed", e);
    } finally {
      setLoadingAdmin(false);
    }
  };

  useEffect(() => {
    if (view === "admin") {
      fetchAdminData();
    }
  }, [view]);
  const [userRating, setUserRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const hasFetchedCloud = useRef(false);

  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        setIsSpeechSupported(true);
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-IN'; // Optimized for Indian English

        recognitionRef.current.onresult = (event: any) => {
          let currentTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            currentTranscript += event.results[i][0].transcript;
          }
          setTranscript(currentTranscript);
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech Recognition Error", event.error);
          setIsListening(false);
          if (event.error === 'not-allowed') {
            setError("Microphone permission denied. Please enable it in browser settings.");
          }
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }
    } catch (e) {
      console.error("Speech Recognition initialization failed:", e);
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setTranscript("");
      setError(null);
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.error("Failed to start speech recognition", e);
        setError("Arre! Could not start voice search. Please try again.");
      }
    }
  };

  const handleVoiceAnalyze = async () => {
    if (!transcript) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const data = await analyzeIngredientsText(transcript, dietaryGoal);
      setResult(data);
      setTimeout(() => setShowRatingModal(true), 1500);
    } catch (err) {
      console.error(err);
      setError("Something went wrong while processing your voice command. Please try again.");
    } finally {
      setIsAnalyzing(false);
      setIsListening(false);
    }
  };

  // Authentication handlers
  const handleAuthSuccess = (userData: any) => {
    setUser(userData);
    setAuthStatus("authenticated");
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setAuthStatus("unauthenticated");
      setResult(null);
      setImage(null);
      setView("home");
    } catch (e) {
      console.error("Logout failed", e);
    }
  };

  // Load preferences and session on mount
  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: firebaseUser.displayName || firebaseUser.email
          });
          setAuthStatus("authenticated");

          // Load UID-scoped favorites from localStorage for immediate UI feedback
          const scopedKey = `cookgenix_favorites_${firebaseUser.uid}`;
          const savedScoped = localStorage.getItem(scopedKey);
          if (savedScoped) {
            try {
              setFavorites(JSON.parse(savedScoped));
            } catch (e) {
              console.error("Failed to load scoped favorites", e);
            }
          }

          // Fetch fresh favorites from backend to stay in sync
          try {
            const token = await firebaseUser.getIdToken();
            const response = await fetch(`${window.location.origin}/api/favorites`, {
              headers: { "Authorization": `Bearer ${token}` }
            });
            if (response.ok) {
              const data = await response.json();
              if (data.favorites) {
                setFavorites(data.favorites);
                // Also update scoped localStorage
                localStorage.setItem(scopedKey, JSON.stringify(data.favorites));
              }
            }
          } catch (err) {
            console.error("Failed to sync session", err);
          } finally {
            hasFetchedCloud.current = true;
          }
        } else {
          setUser(null);
          setAuthStatus("unauthenticated");
          setFavorites([]); // Clear favorites
          setResult(null); // Clear last recipe results
          setImage(null); // Clear last uploaded image
          setView("home"); // Reset view
          setAdminData(null); // Clear admin data
          hasFetchedCloud.current = false;
        }
      });
      
      // Check dark mode preference
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setIsDarkMode(true);
      }
      
      try {
        const savedDarkMode = localStorage.getItem("darkMode");
        if (savedDarkMode !== null) {
          setIsDarkMode(savedDarkMode === "true");
          if (savedDarkMode === "true") {
            document.documentElement.classList.add("dark");
          }
        }
      } catch (e) {
        console.warn("localStorage not accessible", e);
      }

      return () => unsubscribe();
    } catch (e) {
      console.error("Auth initialization effect failed:", e);
      setAuthStatus("unauthenticated"); // Fallback
    }
  }, []);

  // Sync favorites to backend
  useEffect(() => {
    const syncFavorites = async () => {
      // PREVENT OVERWRITE: Only sync if authenticated AND we have successfully fetched the cloud state once
      if (authStatus !== "authenticated" || !auth.currentUser || !hasFetchedCloud.current) return;
      
      try {
        const token = await auth.currentUser.getIdToken();
        await fetch(`${window.location.origin}/api/favorites`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ favorites })
        });
      } catch (err) {
        console.error("Failed to sync favorites with server", err);
      }
    };

    const scopedKey = auth.currentUser ? `cookgenix_favorites_${auth.currentUser.uid}` : null;
    if (scopedKey && hasFetchedCloud.current) {
      try {
        localStorage.setItem(scopedKey, JSON.stringify(favorites));
      } catch (e) {
        console.warn("Failed to save to localStorage", e);
      }
    }
    syncFavorites();
  }, [favorites, authStatus]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleFavorite = (recipe: Recipe) => {
    const isFav = favorites.some(fav => fav.name.trim().toLowerCase() === recipe.name.trim().toLowerCase());
    
    if (isFav) {
      setFavorites(favorites.filter(fav => fav.name.trim().toLowerCase() !== recipe.name.trim().toLowerCase()));
    } else {
      setFavorites([...favorites, { ...recipe, savedAt: new Date().toISOString() }]);
    }
  };

  const isFavorite = (recipe: Recipe) => {
    return favorites.some(fav => fav.name.trim().toLowerCase() === recipe.name.trim().toLowerCase());
  };

  const handleShare = async (recipe?: Recipe) => {
    const text = recipe 
      ? `Check out this recipe for ${recipe.name} from CookGenix!\n\n${recipe.method}`
      : `I just found some amazing recipes based on my fridge ingredients using CookGenix!`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'CookGenix Recipe',
          text: text,
          url: window.location.href
        });
      } catch (err) {
        console.error("Share failed:", err);
      }
    } else {
      // Fallback: Copy to clipboard
      await navigator.clipboard.writeText(text);
      alert("Recipe copied to clipboard!");
    }
  };

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    try {
      localStorage.setItem("darkMode", newMode.toString());
    } catch (e) {
      console.warn("Failed to save preference", e);
    }
    if (newMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setResult(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!image) return;
    if (!isOnline) {
      setError("AI needs internet to analyze your fridge photo. Check your connection!");
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    try {
      const [mimeTypePart, base64Data] = image.split(",");
      const mimeType = mimeTypePart.match(/:(.*?);/)?.[1] || "image/jpeg";
      // analyzeFridgeImage doesn't take goal yet, let's just use text analysis for goals for now if needed or 
      // we could update fridge image too. For simplicity, let's focus text/voice/quick for now.
      const data = await analyzeFridgeImage(base64Data, mimeType);
      setResult(data);
      // Trigger rating modal after a short delay
      setTimeout(() => setShowRatingModal(true), 1500);
    } catch (err) {
      console.error(err);
      setError("Something went wrong while analyzing the ingredients. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const submitRating = async () => {
    if (userRating === 0 || !auth.currentUser) return;
    setRatingSubmitting(true);
    
    try {
      const token = await auth.currentUser.getIdToken();
      await fetch(`${window.location.origin}/api/feedback`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          rating: userRating, 
          message: feedback 
        })
      });
      
      alert("Dhanyawaad! Your feedback has been saved to our database.");
      setShowRatingModal(false);
      setUserRating(0);
      setFeedback("");
    } catch (err) {
      console.error("Failed to save feedback", err);
      alert("Arre! Something went wrong while saving your feedback.");
    } finally {
      setRatingSubmitting(false);
    }
  };

  const handleReset = () => {
    setImage(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (authStatus === 'loading') {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-bg-dark text-white' : 'bg-bg-light text-gray-900'}`}>
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex flex-col items-center gap-4"
        >
          <ChefHat size={60} className="text-primary animate-bounce" />
          <p className="font-black uppercase tracking-[0.2em] text-xs">Preparing Workspace</p>
        </motion.div>
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    return <AuthScreen isDarkMode={isDarkMode} onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-bg-dark text-white' : 'bg-bg-light text-gray-900'} font-sans selection:bg-primary/30 transition-colors duration-300 pb-24`}>
      {/* Rating Modal */}
      <AnimatePresence>
        {showRatingModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className={`max-w-md w-full p-8 rounded-[32px] glass shadow-2xl relative ${isDarkMode ? 'bg-bg-dark text-white' : 'bg-white text-gray-900'}`}
            >
              <button onClick={() => setShowRatingModal(false)} className="absolute top-6 right-6 p-2"><X size={20} /></button>
              <h3 className="text-2xl font-black mb-2 text-primary">Kaise Lagi Service?</h3>
              <p className="text-sm opacity-70 mb-6 font-medium">Please rate your CookGenix experience!</p>
              
              <div className="flex justify-center gap-3 mb-8">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button 
                    key={star} 
                    onClick={() => setUserRating(star)}
                    className={`transition-transform hover:scale-125 ${userRating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                  >
                    <Star size={32} />
                  </button>
                ))}
              </div>

              <textarea 
                placeholder="Any suggestions or feedback? (Optional)"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="w-full p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-primary transition-colors outline-none text-sm font-medium mb-6 min-h-[100px]"
              />

              <button 
                onClick={submitRating}
                disabled={userRating === 0 || ratingSubmitting}
                className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-lg disabled:opacity-50 transition-opacity"
              >
                {ratingSubmitting ? "Submitting..." : "Submit Review"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sleek Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-50 px-6 py-4 flex justify-between items-center glass shadow-sm`}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <ChefHat size={18} className="text-white" />
          </div>
          <span className="text-xl font-extrabold tracking-tight">Cook<span className="text-primary italic">Genix</span></span>
        </div>
        
        <div className="flex items-center gap-3">
          {!isOnline && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/20 text-red-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-500/30">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              Offline
            </div>
          )}
          <div className={`hidden md:flex flex-col items-end mr-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Logged in as</span>
            <span className="text-xs font-bold">{user?.name}</span>
          </div>

          <button 
            onClick={() => setView(view === 'home' ? 'collection' : 'home')}
            className={`p-2 rounded-xl transition-colors relative ${isDarkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}
            title={view === 'home' ? 'My Collection' : 'Back to Home'}
          >
            {view === 'home' ? <Heart size={20} className="text-primary" /> : <Home size={20} className="text-gray-600 dark:text-gray-400" />}
            {favorites.length > 0 && view === 'home' && (
              <span className="absolute -top-1 -right-1 bg-primary text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-bg-dark">
                {favorites.length}
              </span>
            )}
          </button>

          {isAdmin && (
            <button 
              onClick={() => setView(view === 'admin' ? 'home' : 'admin')}
              className={`p-2 rounded-xl transition-colors ${view === 'admin' ? 'bg-primary/20 text-primary' : (isDarkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10')}`}
              title="Admin Dashboard"
            >
              <UserIcon size={20} />
            </button>
          )}
          
          <button 
            onClick={toggleDarkMode}
            className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}
          >
            {isDarkMode ? <Sun size={20} className="text-primary" /> : <Moon size={20} className="text-gray-600" />}
          </button>

          <button 
            onClick={handleLogout}
            className={`p-2 rounded-xl transition-colors text-red-500 ${isDarkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 pt-24">
        <AnimatePresence mode="wait">
          {view === 'admin' ? (
            <motion.div
              key="admin"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-12"
            >
              <div className="text-center space-y-4">
                <h2 className="text-4xl font-black uppercase tracking-tight">Admin <span className="text-primary">Dashboard</span></h2>
                <div className="flex justify-center gap-4">
                  <button 
                    onClick={() => {
                      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(adminData?.users, null, 2));
                      const downloadAnchorNode = document.createElement('a');
                      downloadAnchorNode.setAttribute("href", dataStr);
                      downloadAnchorNode.setAttribute("download", "users_backup.json");
                      document.body.appendChild(downloadAnchorNode);
                      downloadAnchorNode.click();
                      downloadAnchorNode.remove();
                    }}
                    className="text-[10px] font-black uppercase tracking-widest bg-primary text-white px-4 py-2 rounded-full shadow-lg hover:scale-105 transition-transform"
                  >
                    Download Users
                  </button>
                  <button 
                    onClick={() => {
                      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(adminData?.feedback, null, 2));
                      const downloadAnchorNode = document.createElement('a');
                      downloadAnchorNode.setAttribute("href", dataStr);
                      downloadAnchorNode.setAttribute("download", "feedback_backup.json");
                      document.body.appendChild(downloadAnchorNode);
                      downloadAnchorNode.click();
                      downloadAnchorNode.remove();
                    }}
                    className="text-[10px] font-black uppercase tracking-widest bg-gray-900 text-white px-4 py-2 rounded-full shadow-lg hover:scale-105 transition-transform"
                  >
                    Download Feedback
                  </button>
                  <button 
                    onClick={fetchAdminData}
                    className="p-2 rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                  >
                    <RefreshCcw size={16} className={loadingAdmin ? "animate-spin" : ""} />
                  </button>
                </div>
                <p className="text-gray-500 font-medium">
                  {adminData ? `Last updated: ${new Date().toLocaleTimeString()}` : "Real-time view of system data."}
                </p>
              </div>

              {loadingAdmin ? (
                <div className="flex justify-center py-20"><RefreshCcw className="animate-spin text-primary" /></div>
              ) : (
                <div className="grid gap-12">
                  <section className="space-y-6">
                    <h3 className="text-2xl font-bold flex items-center gap-3"><UserIcon className="text-primary" /> Tracked Users ({adminData?.users?.length || 0})</h3>
                    <div className="grid gap-4">
                      {adminData?.users?.map((u: any, i: number) => (
                        <div key={i} className="p-6 glass rounded-2xl flex flex-col md:flex-row justify-between md:items-center gap-4">
                          <div>
                            <p className="font-extrabold text-lg">{u.name}</p>
                            <p className="text-sm opacity-60 font-mono">{u.email}</p>
                          </div>
                          <div className="flex flex-col items-end text-right">
                            <p className="text-[10px] font-black uppercase opacity-40">Last Logged In</p>
                            <p className="text-xs font-bold">{new Date(u.lastLogin || u.createdAt).toLocaleString()}</p>
                            <p className="text-xs text-primary mt-1">{u.favorites?.length || 0} Favorites</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-6">
                    <h3 className="text-2xl font-bold flex items-center gap-3"><Star className="text-yellow-500" /> User Feedback ({adminData?.feedback?.length || 0})</h3>
                    <div className="grid gap-4">
                      {adminData?.feedback?.map((f: any, i: number) => (
                        <div key={i} className="p-6 glass rounded-2xl space-y-3">
                          <div className="flex justify-between items-center">
                            <div className="flex text-yellow-500">
                              {[...Array(5)].map((_, i) => <Star key={i} size={14} fill={i < f.rating ? "currentColor" : "none"} />)}
                            </div>
                            <span className="text-[10px] font-mono opacity-40">{new Date(f.timestamp).toLocaleString()}</span>
                          </div>
                          <p className="font-medium text-sm leading-relaxed italic">"{f.message || "No message left"}"</p>
                          <p className="text-[10px] font-black uppercase text-primary tracking-widest">{f.email}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              )}
            </motion.div>
          ) : view === 'collection' ? (
            <motion.div
              key="collection"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <div className="text-center space-y-4">
                <h2 className="text-4xl font-black italic">My <span className="text-primary">Collection</span></h2>
                <p className="text-gray-500 font-medium">Your favorite hand-picked recipes.</p>
              </div>

              {favorites.length === 0 ? (
                <div className="py-20 text-center glass rounded-[32px] border-dashed border-2 border-gray-200 dark:border-white/10">
                  <Heart size={48} className="mx-auto mb-4 text-gray-300" />
                  <p className="font-bold text-gray-400">Arre! Your collection is empty. Start saving some delicious recipes!</p>
                  <button onClick={() => setView('home')} className="mt-6 text-primary font-black uppercase text-xs tracking-widest hover:underline">
                    Find Recipes Now
                  </button>
                </div>
              ) : (
                <div className="grid gap-8">
                  {favorites.map((recipe, index) => (
                    <RecipeCard 
                      key={index} 
                      recipe={recipe} 
                      isDarkMode={isDarkMode} 
                      isFavorite={true}
                      onFavorite={() => toggleFavorite(recipe)}
                      onShare={() => handleShare(recipe)}
                    />
                  ))}
                </div>
              )}

              {/* Permanent Rating Section */}
              <RatingSection 
                isDarkMode={isDarkMode} 
                userRating={userRating} 
                setUserRating={setUserRating} 
                feedback={feedback} 
                setFeedback={setFeedback} 
                onSubmit={submitRating} 
                submitting={ratingSubmitting} 
              />
            </motion.div>
          ) : (!image && !result && !isAnalyzing) ? (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-10 md:py-20"
            >
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-12"
              >
                <h2 className="text-4xl md:text-6xl font-black mb-6 leading-[1.1]">
                  Turn Your Fridge Into a <span className="gradient-text">Smart Chef</span> 🍳
                </h2>
                <p className="text-gray-500 max-w-lg mx-auto font-medium text-lg leading-relaxed mb-10">
                  Snap a photo of your ingredients and let our AI curate gourmet recipes instantly. 
                </p>

                {/* Conceptual Animation Illustration */}
                <div className="flex items-center justify-center gap-4 mb-12">
                  <motion.div 
                    animate={{ x: [0, 10, 0] }} 
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="p-4 glass rounded-2xl shadow-lg"
                  >
                    <ImageIcon className="text-primary" size={24} />
                  </motion.div>
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="h-px w-8 bg-primary/30" 
                  />
                  <div className="p-4 bg-primary rounded-2xl shadow-xl">
                    <Sparkles className="text-white" size={24} />
                  </div>
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.5, delay: 0.75 }}
                    className="h-px w-8 bg-primary/30" 
                  />
                  <motion.div 
                    animate={{ x: [0, -10, 0] }} 
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="p-4 glass rounded-2xl shadow-lg"
                  >
                    <UtensilsCrossed className="text-secondary" size={24} />
                  </motion.div>
                </div>
              </motion.div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center px-4">
                {/* Diet Selection */}
                <div className="sm:col-span-3 mb-6 flex flex-col items-center gap-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Choose AI Goal</p>
                  <div className="flex flex-wrap justify-center gap-3">
                    {DIETARY_GOALS.map((goal) => (
                      <button
                        key={goal.name}
                        onClick={() => setDietaryGoal(goal.name)}
                        className={`px-6 py-3 rounded-full border-2 transition-all flex items-center gap-3 ${
                          dietaryGoal === goal.name 
                            ? 'bg-primary border-primary text-white shadow-lg scale-105' 
                            : (isDarkMode ? 'bg-white/5 border-white/10 hover:border-primary/50' : 'bg-white border-gray-100 hover:border-primary/50')
                        }`}
                      >
                        <span className={dietaryGoal === goal.name ? 'text-white' : 'text-primary'}>{goal.icon}</span>
                        <div className="text-left">
                          <p className="text-xs font-black leading-none">{goal.name}</p>
                          <p className={`text-[8px] font-bold uppercase opacity-50 ${dietaryGoal === goal.name ? 'text-white' : ''}`}>{goal.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-3 flex justify-center mb-8">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleQuickCookNow}
                    disabled={isAnalyzing}
                    className="group relative px-10 py-5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-[24px] font-black shadow-[0_15px_40px_rgba(249,115,22,0.3)] flex items-center gap-4 uppercase tracking-wider overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
                    <span className="text-2xl">🔥</span>
                    <div className="text-left">
                      <p className="text-sm leading-none">{isAnalyzing ? "Cooking..." : "Quick Cook"}</p>
                      <p className="text-[9px] opacity-70">{isAnalyzing ? "AI is thinking" : "What can I cook now?"}</p>
                    </div>
                    <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </motion.button>
                </div>

                {/* Visual Native Camera Integration */}
                <div className="relative group">
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment" 
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    title="Take Photo"
                  />
                  <CaptureCard 
                    title="Camera" 
                    desc="Native App" 
                    icon={<Camera size={24} />} 
                    primary
                    isDarkMode={isDarkMode}
                  />
                </div>

                {/* Gallery Integration */}
                <div className="relative group">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    title="Choose Image"
                  />
                  <CaptureCard 
                    title="Gallery" 
                    desc="Pick Media" 
                    icon={<ImageIcon size={24} />} 
                    isDarkMode={isDarkMode}
                  />
                </div>

                {/* Voice Integration */}
                <div className={`relative group ${!isSpeechSupported ? 'opacity-40 grayscale cursor-not-allowed' : ''}`}>
                  <CaptureCard 
                    title="Voice" 
                    desc={!isSpeechSupported ? "Not Supported" : (isListening ? "Listening..." : "Tell Chef")} 
                    icon={isListening ? <MicOff size={24} className="text-red-500 animate-pulse" /> : <Mic size={24} />} 
                    onClick={isSpeechSupported ? toggleListening : () => setError("Arre! Your browser doesn't support the Voice Chef feature.")}
                    isDarkMode={isDarkMode}
                  />
                  {!isSpeechSupported && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                      <div className="bg-black/80 text-white text-[8px] font-black px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-tighter">
                        Browser limit
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Error Display for Home View */}
              <AnimatePresence>
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="max-w-md mx-auto mt-6"
                  >
                    <div className="p-4 bg-red-500/10 rounded-2xl border border-red-500/20 text-red-500 text-xs font-bold flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Info size={14} />
                        <p>{error}</p>
                      </div>
                      <button onClick={() => setError(null)} className="p-1 hover:bg-red-500/10 rounded-lg">
                        <X size={14} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Speech Transcript Overlay */}
              <AnimatePresence>
                {(isListening || transcript) && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="mt-8 p-8 glass rounded-[32px] border-2 border-primary/30 max-w-lg mx-auto"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isListening ? 'bg-red-500 animate-pulse' : 'bg-primary'}`}>
                          <Mic size={18} className="text-white" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                          {isListening ? "Listening to ingredients..." : "Voice Input Received"}
                        </p>
                      </div>
                      <button onClick={() => { setIsListening(false); setTranscript(""); }} className="p-1 opacity-40 hover:opacity-100"><X size={16}/></button>
                    </div>
                    
                    <p className={`text-lg font-bold italic ${!transcript ? 'text-gray-400' : ''}`}>
                      {transcript || "Speak your ingredients (e.g., 'I have 2 eggs, some milk, and flour')"}
                    </p>

                    {transcript && !isListening && (
                      <button 
                        onClick={handleVoiceAnalyze}
                        className="w-full mt-6 py-4 bg-primary text-white rounded-2xl font-black shadow-lg hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                      >
                        <Sparkles size={18} /> Plan My Meals
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Footer Icons */}
              <div className="mt-20 flex justify-center gap-12 opacity-40 grayscale pointer-events-none">
                <ChefHat size={40} />
                <UtensilsCrossed size={40} />
                <Sparkles size={40} />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="process"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-12"
            >
              {/* Image Preview Card */}
              {image && (
                <div className="relative group">
                  <motion.div 
                    layoutId="target"
                    className="relative rounded-[32px] overflow-hidden shadow-2xl bg-gray-200 aspect-video md:aspect-[21/9] border-4 border-white dark:border-white/5"
                  >
                    <img src={image} alt="User fridge" className="w-full h-full object-cover" />
                    {isAnalyzing && (
                      <motion.div 
                        className="absolute inset-x-0 h-1 bg-primary/80 shimmer z-20" 
                        animate={{ top: ["0%", "100%", "0%"] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <button 
                      onClick={handleReset}
                      className="absolute top-6 right-6 p-4 bg-white/90 dark:bg-black/90 rounded-2xl text-primary hover:scale-110 transition-transform shadow-lg z-30"
                    >
                      <RefreshCcw size={20} />
                    </button>
                  </motion.div>
                </div>
              )}

              {!result && !isAnalyzing && (
                <div className="text-center space-y-6">
                  <h3 className="text-3xl font-extrabold">Ready to explore?</h3>
                  <button 
                    onClick={handleAnalyze}
                    className="w-full max-w-sm py-5 px-8 bg-primary text-white rounded-[24px] font-black shadow-[0_10px_40px_rgba(255,122,0,0.3)] hover:scale-[1.02] transition-transform flex items-center justify-center gap-3 uppercase tracking-wider"
                  >
                    <Sparkles size={20} />
                    Analyze Ingredients
                  </button>
                </div>
              )}

              {isAnalyzing && (
                <div className="text-center space-y-4">
                  <div className="inline-flex flex-col items-center">
                    <motion.div 
                      animate={{ scale: [1, 1.1, 1] }} 
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="text-primary mb-2"
                    >
                      <ChefHat size={48} />
                    </motion.div>
                    <h3 className="text-2xl font-black">AI is scanning...</h3>
                    <p className="text-gray-500 italic">"Finding the hidden gems in your fridge..."</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="space-y-4">
                  <div className="p-5 bg-red-500/10 rounded-2xl border border-red-500 text-red-500 text-sm font-bold flex items-center gap-3">
                    <Info size={18} />
                    <p>{error}</p>
                  </div>
                </div>
              )}

              {result && (
                <div className="space-y-16 animate-in fade-in slide-in-from-bottom-5 duration-700">
                  {/* Ingredient Chips */}
                  <div className="space-y-6">
                    <h4 className="text-lg font-black uppercase tracking-widest text-primary/80">Identified Ingredients</h4>
                    <div className="flex flex-wrap gap-3">
                      {result.identifiedIngredients.map((ing, i) => (
                        <span key={i} className="px-5 py-2.5 glass rounded-full text-sm font-bold flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-secondary" />
                          {ing}
                        </span>
                      ))}
                    </div>
                  </div>

                    {/* Recipe Grid */}
                    <div className="space-y-8">
                      <h4 className="text-lg font-black uppercase tracking-widest text-primary/80">Tailored For You</h4>
                      <div className="grid gap-8">
                        {result.recipes.map((recipe, index) => (
                          <RecipeCard 
                            key={index} 
                            recipe={recipe} 
                            index={index} 
                            isDarkMode={isDarkMode} 
                            isFavorite={isFavorite(recipe)}
                            onFavorite={() => toggleFavorite(recipe)}
                            onShare={() => handleShare(recipe)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Overall Chef's Tip */}
                    {result.chefsTip && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-8 glass rounded-[32px] border-2 border-primary/20 bg-primary/5 space-y-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white">
                            <ChefHat size={20} />
                          </div>
                          <div>
                            <h4 className="text-lg font-black leading-none">Chef's Final Wisdom</h4>
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary mt-1">General Kitchen Hack</p>
                          </div>
                        </div>
                        <p className="text-sm font-semibold opacity-80 leading-relaxed italic">
                          "{result.chefsTip}"
                        </p>
                      </motion.div>
                    )}

                    {/* Extra Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4 justify-center py-10">
                    <button 
                      onClick={() => handleShare()}
                      className="flex items-center justify-center gap-3 px-8 py-4 glass rounded-2xl font-bold hover:bg-primary/10 transition-colors"
                    >
                      <Share2 size={20} /> Share Results
                    </button>
                    <button 
                      onClick={handleReset}
                      className="flex items-center justify-center gap-3 px-8 py-4 bg-primary/10 text-primary rounded-2xl font-bold hover:bg-primary/20 transition-colors"
                    >
                      <RotateCcw size={20} /> Try Another Photo
                    </button>
                  </div>

                  {/* Permanent Rating Section */}
                  <RatingSection 
                    isDarkMode={isDarkMode} 
                    userRating={userRating} 
                    setUserRating={setUserRating} 
                    feedback={feedback} 
                    setFeedback={setFeedback} 
                    onSubmit={submitRating} 
                    submitting={ratingSubmitting} 
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Nav */}
      <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-8 py-4 glass border border-white/20 rounded-full shadow-2xl flex items-center gap-16`}>
        <NavButton icon={<Home size={22} />} active={view === 'home'} onClick={() => setView('home')} />
        <PlusButton onClick={() => { handleReset(); setView('home'); }} />
        <div className="relative">
          <NavButton icon={<Heart size={22} />} active={view === 'collection'} onClick={() => setView('collection')} />
          {favorites.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-bg-dark">
              {favorites.length}
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-gray-400 py-10 text-xs font-bold uppercase tracking-widest">
        CookGenix Artifical Intelligence Engine v4.0
      </footer>
    </div>
  );
}

function CaptureCard({ title, desc, icon, onClick, primary, isDarkMode }: any) {
  return (
    <motion.button
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`relative w-full p-8 rounded-[32px] text-left overflow-hidden border-2 transition-all ${
        primary 
          ? 'bg-primary text-white border-primary shadow-[0_10px_30px_rgba(255,122,0,0.2)]' 
          : 'glass border-transparent shadow-xl'
      }`}
    >
      <div className={`w-14 h-14 rounded-[20px] flex items-center justify-center mb-6 ${primary ? 'bg-white/20' : 'bg-primary/10 text-primary'}`}>
        {icon}
      </div>
      <div>
        <h4 className="text-2xl font-black mb-1 leading-none">{title}</h4>
        <p className={`text-sm font-medium ${primary ? 'text-white/80' : 'text-gray-500'}`}>{desc}</p>
      </div>
      <div className="absolute top-6 right-6 opacity-20 transform rotate-12 group-hover:rotate-0 transition-transform">
        <Sparkles size={40} />
      </div>
    </motion.button>
  );
}

function RecipeCard({ recipe: initialRecipe, isDarkMode, isFavorite, onFavorite, onShare }: any) {
  const [recipe, setRecipe] = useState(initialRecipe);
  const [isOpen, setIsOpen] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [customRequest, setCustomRequest] = useState("");
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [substitutes, setSubstitutes] = useState<Record<string, string>>({});
  const [loadingSubs, setLoadingSubs] = useState<Record<string, boolean>>({});
  const [mainImageUrl, setMainImageUrl] = useState<string | null>(recipe.mainImageUrl || null);
  const [isGeneratingMain, setIsGeneratingMain] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const displaySteps = useMemo(() => {
    if (recipe.steps && recipe.steps.length > 0) return recipe.steps;
    
    if (recipe.method) {
      const lines = recipe.method
        .split(/\d+\.|\n/)
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 5);
        
      if (lines.length > 0) {
        return lines.map((line: string) => ({
          text: line,
          visualPrompt: `Detailed cooking step: ${line.substring(0, 80)}... culinary photography, photorealistic`
        }));
      }
    }
    return [];
  }, [recipe]);

  const toggleStep = (index: number) => {
    const newSteps = new Set(completedSteps);
    if (newSteps.has(index)) {
      newSteps.delete(index);
    } else {
      newSteps.add(index);
    }
    setCompletedSteps(newSteps);
  };

  const handleCustomize = async () => {
    if (!customRequest.trim() || isCustomizing) return;
    setIsCustomizing(true);
    try {
      const newRecipe = await customizeRecipe(recipe, customRequest);
      setRecipe(newRecipe);
      setMainImageUrl(null); // Reset image to generate a new one for the customized dish
      setCustomRequest("");
      setCompletedSteps(new Set());
      setLocalError(null);
    } catch (e) {
      console.error("Customization failed", e);
      setLocalError("Chef is slightly confused! Try a different request.");
    } finally {
      setIsGeneratingMain(false);
      setIsCustomizing(false);
    }
  };

  const handleGetSubstitute = async (ingredient: string) => {
    if (loadingSubs[ingredient] || substitutes[ingredient]) return;
    
    setLoadingSubs(prev => ({ ...prev, [ingredient]: true }));
    try {
      const sub = await getIngredientSubstitute(ingredient, recipe.name);
      setSubstitutes(prev => ({ ...prev, [ingredient]: sub }));
    } catch (e) {
      console.error("Sub failed", e);
    } finally {
      setLoadingSubs(prev => ({ ...prev, [ingredient]: false }));
    }
  };

  useEffect(() => {
    if (isOpen && !mainImageUrl && recipe.dishImagePrompt && !isGeneratingMain) {
      const loadMainImage = async () => {
        setIsGeneratingMain(true);
        try {
          const url = await generateRecipeImage(recipe.dishImagePrompt);
          setMainImageUrl(url);
        } catch (e) {
          console.error("Main image failed", e);
        } finally {
          setIsGeneratingMain(false);
        }
      };
      loadMainImage();
    }
  }, [isOpen, recipe.dishImagePrompt, mainImageUrl, isGeneratingMain]);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`rounded-[32px] overflow-hidden border-2 transition-all duration-300 ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-white border-gray-100 shadow-xl'}`}
    >
      {/* Featured Dish Image */}
      {isOpen && (
        <div className="relative h-48 md:h-64 bg-black/5 dark:bg-white/5 overflow-hidden">
          {mainImageUrl ? (
            <motion.img 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              src={mainImageUrl} 
              alt={recipe.name} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : isGeneratingMain ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <Sparkles className="text-primary animate-pulse" size={24} />
              <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Styling the dish...</span>
            </div>
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-6 left-8">
            <h3 className="text-2xl font-black text-white leading-tight">{recipe.name}</h3>
          </div>
        </div>
      )}

      <div className="p-8">
        {!isOpen && (
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-3 px-4 py-2 glass rounded-2xl">
                <span className="text-[10px] font-black uppercase tracking-widest">{recipe.type}</span>
              </div>
              {recipe.cookingTime && (
                <div className="flex items-center gap-2 px-3 py-2 glass rounded-2xl text-[10px] font-black uppercase tracking-widest text-primary">
                  <Clock size={12} />
                  <span>{recipe.cookingTime}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <motion.button 
                whileTap={{ scale: 0.8 }}
                onClick={onShare}
                className="w-10 h-10 rounded-full glass flex items-center justify-center text-gray-400 hover:text-primary transition-colors"
              >
                <Share2 size={18} />
              </motion.button>
              <motion.button 
                whileTap={{ scale: 0.8 }}
                onClick={onFavorite}
                className={`w-10 h-10 rounded-full glass flex items-center justify-center transition-colors ${isFavorite ? 'text-primary' : 'text-gray-400 hover:text-primary'}`}
              >
                {isFavorite ? <BookmarkCheck size={18} className="fill-primary" /> : <Bookmark size={18} />}
              </motion.button>
            </div>
          </div>
        )}

        {isOpen && (
           <div className="flex justify-end items-center mb-4 -mt-2">
              <div className="flex items-center gap-2">
                <motion.button 
                  whileTap={{ scale: 0.8 }}
                  onClick={onShare}
                  className="w-8 h-8 rounded-full glass flex items-center justify-center text-gray-400 hover:text-primary transition-colors"
                >
                  <Share2 size={14} />
                </motion.button>
                <motion.button 
                  whileTap={{ scale: 0.8 }}
                  onClick={onFavorite}
                  className={`w-8 h-8 rounded-full glass flex items-center justify-center transition-colors ${isFavorite ? 'text-primary' : 'text-gray-400 hover:text-primary'}`}
                >
                  {isFavorite ? <BookmarkCheck size={14} className="fill-primary" /> : <Bookmark size={14} />}
                </motion.button>
              </div>
           </div>
        )}

        {(!isOpen || isCustomizing) && (
          <div className="flex flex-col gap-2 mb-2">
            <div className="flex items-center gap-3">
              <h3 className="text-2xl font-black leading-tight">{recipe.name}</h3>
              {isFavorite && (
                <motion.span 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="bg-primary/20 text-primary text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1"
                >
                  <CheckCircle2 size={10} /> SAVED
                </motion.span>
              )}
            </div>
            
            {recipe.nutrition && (
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] font-black">
                  <Star size={10} className="fill-orange-500" /> {recipe.nutrition.calories} kcal
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-black">
                  <UserIcon size={10} /> {recipe.nutrition.protein} Protein
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] font-black">
                  <UtensilsCrossed size={10} /> {recipe.nutrition.carbs} Carbs
                </div>
              </div>
            )}

            {isCustomizing && (
               <div className="flex items-center gap-2 text-primary animate-pulse mt-1">
                 <RefreshCcw size={14} className="animate-spin" />
                 <span className="text-[10px] font-black uppercase">Tailoring...</span>
               </div>
            )}
          </div>
        )}
        
        <div className="space-y-4 mb-8">
          <p className="text-[10px] font-black text-primary uppercase tracking-widest">Ingredients</p>
          <div className="flex flex-wrap gap-2">
            {recipe.ingredients.map((ing: string, i: number) => (
              <div key={i} className="group relative">
                <button 
                  onClick={() => handleGetSubstitute(ing)}
                  className={`px-3 py-1.5 rounded-xl border-2 text-xs font-bold transition-all flex items-center gap-2 ${
                    substitutes[ing] 
                      ? 'bg-primary border-primary text-white shadow-lg' 
                      : (isDarkMode ? 'bg-white/5 border-white/10 hover:border-primary/50' : 'bg-gray-50 border-gray-100 hover:border-primary/50')
                  }`}
                >
                  {ing}
                  {loadingSubs[ing] ? (
                    <RefreshCcw size={10} className="animate-spin" />
                  ) : substitutes[ing] ? (
                    <Info size={10} />
                  ) : (
                    <Plus size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
                <AnimatePresence>
                  {substitutes[ing] && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.9 }}
                      className="absolute bottom-full left-0 mb-2 w-48 p-3 rounded-2xl bg-primary text-white text-[10px] font-bold shadow-2xl z-50 leading-relaxed"
                    >
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <span className="uppercase tracking-widest opacity-80">Substitute</span>
                        <button onClick={(e) => { e.stopPropagation(); setSubstitutes(prev => { const n = {...prev}; delete n[ing]; return n; })}}>
                          <X size={10} />
                        </button>
                      </div>
                      {substitutes[ing]}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>

        <button 
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full py-4 px-6 rounded-2xl flex items-center justify-between font-bold text-sm transition-colors ${isDarkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-black/5 hover:bg-black/10'}`}
        >
          <span>{isOpen ? 'Minimize Recipe' : 'See Full Recipe'}</span>
          <ChevronRight size={18} className={`transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-8 border-t border-white/10 mt-6 space-y-12">
                {/* Customizer Section */}
                <div className={`p-6 rounded-[28px] border-2 transition-all ${isDarkMode ? 'bg-white/5 border-primary/20' : 'bg-primary/5 border-primary/10'} space-y-4`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="text-primary" size={16} />
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest">AI Super-Chef Customizer</p>
                    </div>
                    {isCustomizing && (
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                        className="text-primary"
                      >
                        <RefreshCcw size={14} />
                      </motion.div>
                    )}
                  </div>
                  
                  <p className="text-xs font-bold opacity-60 leading-relaxed">
                    Want to swap ingredients? Make it vegan? Or maybe healthier? Just ask!
                  </p>

                  {localError && (
                    <motion.p 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[10px] font-bold text-red-500 bg-red-500/10 p-2 rounded-lg"
                    >
                      {localError}
                    </motion.p>
                  )}

                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={customRequest}
                      onChange={(e) => setCustomRequest(e.target.value)}
                      placeholder="e.g., Make it kid-friendly..."
                      className={`flex-1 bg-transparent border-b-2 py-2 text-sm font-bold outline-none transition-colors ${
                        isDarkMode ? 'border-white/10 focus:border-primary' : 'border-black/10 focus:border-primary'
                      }`}
                      onKeyDown={(e) => e.key === 'Enter' && handleCustomize()}
                    />
                    <button 
                      onClick={handleCustomize}
                      disabled={isCustomizing || !customRequest.trim()}
                      className="p-2 bg-primary text-white rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                    >
                      {isCustomizing ? <RefreshCcw size={20} className="animate-spin" /> : <ChevronRight size={20} />}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {['Make it Vegan', 'Spicier', 'Low Calorie', 'Jain version'].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setCustomRequest(suggestion)}
                        className={`text-[9px] font-black uppercase tracking-tighter px-2 py-1 rounded-md border transition-all ${
                          isDarkMode ? 'border-white/10 hover:border-primary/50' : 'border-black/5 hover:border-primary/30'
                        }`}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step-by-Step Guide */}
                <div className="space-y-6">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                    <UtensilsCrossed size={12} /> Step-by-Step Instructions
                  </p>
                  <div className="space-y-10">
                    {displaySteps.map((step: RecipeStep, i: number) => (
                      <StepWithVisual 
                        key={i} 
                        step={step} 
                        index={i} 
                        isDarkMode={isDarkMode}
                        isCompleted={completedSteps.has(i)}
                        onToggle={() => toggleStep(i)}
                      />
                    ))}
                  </div>
                </div>

                {recipe.tips && recipe.tips.length > 0 && (
                  <div className="space-y-4 p-6 rounded-[24px] bg-primary/5 border border-primary/10">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                      <Sparkles size={12} /> Pro-Tips ({recipe.tips.length})
                    </p>
                    <ul className="space-y-3">
                      {recipe.tips.map((tip: string, i: number) => (
                        <li key={i} className="flex gap-3 text-sm font-semibold opacity-90 leading-relaxed">
                          <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 text-[10px] font-black">
                            {i + 1}
                          </span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function StepWithVisual({ step, index, isDarkMode, isCompleted, onToggle }: any) {
  return (
    <div 
      onClick={onToggle}
      className={`flex flex-col gap-4 group cursor-pointer p-4 -m-4 rounded-3xl transition-all duration-300 ${
        isCompleted ? (isDarkMode ? 'bg-green-500/5 opacity-60' : 'bg-green-50/50 opacity-60') : 'hover:bg-black/5 dark:hover:bg-white/5'
      }`}
    >
      <div className="space-y-3">
        <div className="flex items-start gap-4">
          <div className="pt-1">
            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
              isCompleted 
                ? 'bg-green-500 border-green-500 text-white' 
                : (isDarkMode ? 'border-white/20' : 'border-gray-200')
            }`}>
              {isCompleted && <CheckCircle2 size={14} />}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className={`text-[10px] font-black uppercase tracking-widest ${isCompleted ? 'text-green-500' : 'text-primary'}`}>
                Step {index + 1}
              </span>
              {isCompleted && (
                <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">
                  Completed
                </span>
              )}
            </div>
            <p className={`text-sm leading-[1.6] font-medium transition-all ${
              isCompleted ? 'line-through opacity-50' : 'opacity-90'
            }`}>
              {step.text}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavButton({ icon, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`p-2 transition-all ${active ? 'text-primary scale-125' : 'text-gray-400 hover:text-primary hover:scale-110'}`}
    >
      {icon}
    </button>
  );
}

function PlusButton({ onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className="w-14 h-14 bg-primary rounded-3xl -mt-10 flex items-center justify-center text-white shadow-[0_10px_30px_rgba(255,122,0,0.4)] hover:scale-110 active:scale-90 transition-all border-4 border-white dark:border-bg-dark"
    >
      <Plus size={28} />
    </button>
  );
}


function RatingSection({ isDarkMode, userRating, setUserRating, feedback, setFeedback, onSubmit, submitting }: any) {
  return (
    <div className={`mt-20 p-8 rounded-[40px] border-2 ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-white border-gray-100 shadow-xl'}`}>
      <div className="max-w-xl mx-auto text-center space-y-6">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl mx-auto flex items-center justify-center text-primary">
          <Star size={32} />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-black">Help Us Grow! 🚀</h3>
          <p className="text-gray-500 font-medium">Your feedback helps CookGenix create even better recipes for you.</p>
        </div>

        <div className="flex justify-center gap-3">
          {[1, 2, 3, 4, 5].map((star) => (
            <button 
              key={star} 
              onClick={() => setUserRating(star)}
              className={`transition-transform hover:scale-125 ${userRating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
            >
              <Star size={32} />
            </button>
          ))}
        </div>

        <textarea 
          placeholder="Share your experience or suggest features..."
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          className="w-full p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-primary transition-colors outline-none text-sm font-medium min-h-[100px]"
        />

        <button 
          onClick={onSubmit}
          disabled={userRating === 0 || submitting}
          className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-lg disabled:opacity-50 transition-opacity uppercase tracking-wider text-sm"
        >
          {submitting ? "Sending Feedback..." : "Submit Review"}
        </button>
      </div>
    </div>
  );
}
