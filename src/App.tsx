import { useState, useRef, type ChangeEvent, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Camera, ChefHat, Sparkles, UtensilsCrossed, RefreshCcw, 
  CheckCircle2, ChevronRight, Info, X,
  Moon, Sun, Heart, Share2, Home, 
  Plus, Star, Clock, LogOut, User as UserIcon, Bookmark, BookmarkCheck,
  Image as ImageIcon, Mic, MicOff, RotateCcw, Search, Mail, Calendar, ArrowRight, Copy, ShieldCheck
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
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { db, auth } from "./lib/firebase";
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

  const [adminData, setAdminData] = useState<{ users: any[], feedback: any[], recipes: any[] } | null>(null);
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [adminTab, setAdminTab] = useState<string>("Overview");
  const [adminSearch, setAdminSearch] = useState("");
  const [adminTypeFilter, setAdminTypeFilter] = useState("All");
  const [adminRatingFilter, setAdminRatingFilter] = useState(0);
  const [selectedAdminUser, setSelectedAdminUser] = useState<any>(null);
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
      // Fetch directly from Firestore (Bypassing server endpoints)
      const [uSnap, fSnap, rSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "feedback")),
        getDocs(collection(db, "recipes"))
      ]);

      setAdminData({
        users: uSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        feedback: fSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        recipes: rSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      });
    } catch (e) {
      console.error("Admin fetch failed", e);
      setError("Admin access failed. Check if you are truly logged in as admin.");
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
  const [recipesLoading, setRecipesLoading] = useState(false);

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

  // Authentication and Real-time Data Sync
  useEffect(() => {
    try {
      const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          const userData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: firebaseUser.displayName || firebaseUser.email
          };
          setUser(userData);
          setAuthStatus("authenticated");

          // User Tracking: Save/Update user profile in Firestore
          try {
            const userRef = doc(db, "users", firebaseUser.uid);
            await setDoc(userRef, {
              user_id: firebaseUser.uid,
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || "Unknown",
              lastLogin: new Date().toISOString(),
              updatedAt: serverTimestamp()
            }, { merge: true });
          } catch (err) {
            console.error("User tracking failed:", err);
          }
        } else {
          setUser(null);
          setAuthStatus("unauthenticated");
          setFavorites([]);
          setResult(null);
          setImage(null);
          setView("home");
          setAdminData(null);
        }
      });
      
      // Load dark mode preference
      try {
        const savedDarkMode = localStorage.getItem("darkMode");
        if (savedDarkMode !== null) {
          setIsDarkMode(savedDarkMode === "true");
          if (savedDarkMode === "true") {
            document.documentElement.classList.add("dark");
          }
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          setIsDarkMode(true);
          document.documentElement.classList.add("dark");
        }
      } catch (e) {
        console.warn("localStorage not accessible", e);
      }

      return () => unsubscribeAuth();
    } catch (e) {
      console.error("Auth initialization failed:", e);
      setAuthStatus("unauthenticated");
    }
  }, []);

  // Dedicated Real-time Recipes Listener
  useEffect(() => {
    if (authStatus !== "authenticated" || !user?.uid) return;

    setRecipesLoading(true);
    const q = query(collection(db, "recipes"), where("user_id", "==", user.uid));
    
    const unsubscribeRecipes = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Recipe));
      
      setFavorites(docs);
      setRecipesLoading(false);
      
      // Update local storage for immediate future loads if needed (offline support)
      try {
        localStorage.setItem(`cookgenix_favorites_${user.uid}`, JSON.stringify(docs));
      } catch (e) {
        console.warn("Local storage update failed", e);
      }
    }, (err) => {
      console.error("Recipes sync failed:", err);
      setRecipesLoading(false);
    });

    return () => unsubscribeRecipes();
  }, [authStatus, user?.uid]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleFavorite = async (recipe: Recipe) => {
    if (!user?.uid) return;
    
    // Check if favorite by ID or Name
    const existingRecipe = favorites.find(fav => 
      (fav.id && recipe.id && fav.id === recipe.id) || 
      (fav.name.trim().toLowerCase() === recipe.name.trim().toLowerCase())
    );
    
    try {
      if (existingRecipe && existingRecipe.id) {
        // Remove from Firestore
        await deleteDoc(doc(db, "recipes", existingRecipe.id));
      } else {
        // Add to Firestore
        const recipeToSave = {
          ...recipe,
          user_id: user.uid,
          savedAt: new Date().toISOString(),
          updatedAt: serverTimestamp()
        };
        // Clean up undefined fields for Firestore
        Object.keys(recipeToSave).forEach(key => {
          if ((recipeToSave as any)[key] === undefined) delete (recipeToSave as any)[key];
        });
        
        await addDoc(collection(db, "recipes"), recipeToSave);
      }
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
      setError("Arre! Failed to save your recipe. Please check your connection.");
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
    if (userRating === 0 || !user?.uid) return;
    setRatingSubmitting(true);
    
    try {
      await addDoc(collection(db, "feedback"), {
        user_id: user.uid,
        email: user.email,
        rating: userRating,
        message: feedback,
        timestamp: new Date().toISOString()
      });
      
      alert("Dhanyawaad! Your feedback has been saved to our database.");
      setShowRatingModal(false);
      setUserRating(0);
      setFeedback("");
    } catch (err) {
      console.error("Failed to save feedback", err);
      setError("Arre! Something went wrong while saving your feedback.");
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
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-12 pb-20"
            >
              <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="text-left">
                  <h2 className="text-4xl font-black uppercase tracking-tight">Admin <span className="text-primary italic">Command</span></h2>
                  <p className="text-xs font-bold uppercase opacity-40 tracking-widest mt-1">Platform-wide Insights & Activity</p>
                </div>
                <div className="flex gap-2 bg-black/5 dark:bg-white/5 p-1 rounded-2xl">
                  {['Overview', 'Users', 'Recipes', 'Feedback'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setAdminTab(tab)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${adminTab === tab ? 'bg-primary text-white shadow-lg' : 'opacity-50 hover:opacity-100'}`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Users', value: adminData?.users?.length || 0, icon: <UserIcon size={16} /> },
                  { label: 'Saved Recipes', value: adminData?.recipes?.length || 0, icon: <Bookmark size={16} /> },
                  { label: 'Feedback', value: adminData?.feedback?.length || 0, icon: <Star size={16} /> },
                  { label: 'System Health', value: 'Live', icon: <CheckCircle2 size={16} />, color: 'text-green-500' }
                ].map((stat, i) => (
                  <div key={i} className="p-6 glass rounded-3xl border border-white/10">
                    <div className={`p-2 bg-primary/10 rounded-xl w-fit mb-3 ${stat.color || 'text-primary'}`}>{stat.icon}</div>
                    <p className="text-2xl font-black">{stat.value}</p>
                    <p className="text-[10px] font-bold uppercase opacity-40 tracking-widest">{stat.label}</p>
                  </div>
                ))}
              </div>

              {loadingAdmin ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <RefreshCcw className="animate-spin text-primary" size={40} />
                  <p className="text-xs font-black uppercase tracking-widest opacity-40">Syncing Cloud Data...</p>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  {adminTab === 'Overview' && (
                    <motion.div key="ov" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                          <h4 className="text-sm font-black uppercase tracking-[0.2em] opacity-40 flex items-center gap-2">
                             <Clock size={14} /> Recent Logins
                          </h4>
                          <div className="space-y-3">
                            {adminData?.users?.slice(0, 5).map((u: any, i: number) => (
                              <div key={i} className="p-4 glass rounded-2xl flex justify-between items-center">
                                <div>
                                  <p className="font-extrabold text-sm">{u.name}</p>
                                  <p className="text-[10px] opacity-50">{u.email}</p>
                                </div>
                                <span className="text-[10px] font-bold opacity-30">{new Date(u.lastLogin).toLocaleTimeString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-6">
                          <h4 className="text-sm font-black uppercase tracking-[0.2em] opacity-40 flex items-center gap-2">
                             <RotateCcw size={14} /> Latest Saved Recipes
                          </h4>
                          <div className="space-y-3">
                            {adminData?.recipes?.slice(0, 5).map((r: any, i: number) => (
                              <div key={i} className="p-4 glass rounded-2xl flex justify-between items-center">
                                <p className="font-extrabold text-sm truncate max-w-[150px]">{r.name}</p>
                                <div className="text-right">
                                  <p className="text-[10px] font-black text-primary uppercase">{r.type}</p>
                                  <p className="text-[8px] opacity-30">{new Date(r.savedAt).toLocaleDateString()}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex justify-center gap-4 pt-8">
                        <button onClick={fetchAdminData} className="p-3 bg-primary/20 text-primary rounded-2xl hover:bg-primary/30 transition-all flex items-center gap-2 text-xs font-black uppercase">
                          <RefreshCcw size={14} /> Refresh Logs
                        </button>
                        <button 
                          onClick={() => {
                            const fullData = { users: adminData?.users, feedback: adminData?.feedback, recipes: adminData?.recipes, exportedAt: new Date().toISOString() };
                            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullData, null, 2));
                            const downloadAnchorNode = document.createElement('a');
                            downloadAnchorNode.setAttribute("href", dataStr);
                            downloadAnchorNode.setAttribute("download", "system_full_backup.json");
                            downloadAnchorNode.click();
                          }}
                          className="p-3 bg-black text-white dark:bg-white dark:text-black rounded-2xl hover:scale-105 transition-all text-xs font-black uppercase"
                        >
                          Full Database Backup
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {adminTab === 'Users' && (
                    <motion.div key="us" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                      <div className="flex flex-col md:flex-row gap-4 items-center">
                        <div className="relative flex-1">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary opacity-50" size={18} />
                          <input 
                            type="text" 
                            placeholder="Search by name, email, or UID..."
                            value={adminSearch}
                            onChange={(e) => setAdminSearch(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 glass rounded-2xl border border-transparent focus:border-primary outline-none transition-all font-bold text-sm"
                          />
                        </div>
                        <div className="p-3 glass rounded-2xl flex items-center gap-2">
                           <UserIcon size={14} className="text-primary" />
                           <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Total: {adminData?.users?.length || 0} Users</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        {(adminData?.users || [])
                          .filter(u => 
                            u.name?.toLowerCase().includes(adminSearch.toLowerCase()) || 
                            u.email?.toLowerCase().includes(adminSearch.toLowerCase()) ||
                            u.uid?.toLowerCase().includes(adminSearch.toLowerCase())
                          )
                          .map((u: any, i: number) => {
                            const userRecipes = adminData?.recipes?.filter(r => r.user_id === u.uid) || [];
                            const userFeedback = adminData?.feedback?.filter(f => f.email === u.email) || [];
                            const isGoogleUser = u.email === u.name; // Simple heuristic or we could check providerData
                            
                            return (
                              <div 
                                key={i} 
                                onClick={() => {
                                  setSelectedAdminUser(u);
                                  setAdminTab('User Focus');
                                }}
                                className="p-4 glass rounded-[24px] flex flex-col md:flex-row justify-between md:items-center gap-4 group cursor-pointer hover:bg-primary/5 transition-all border border-transparent hover:border-primary/20"
                              >
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">
                                    {u.name?.[0].toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="font-black text-sm">{u.name}</p>
                                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${userFeedback.length > 0 ? 'bg-yellow-500/10 text-yellow-600' : 'bg-gray-500/10 text-gray-500'}`}>
                                        {userFeedback.length > 0 ? 'Reviewer' : 'Silent'}
                                      </span>
                                    </div>
                                    <div className="flex flex-col gap-1.5 mt-1.5">
                                      <div className="flex items-center gap-2 px-2 py-1 bg-primary/[0.03] rounded-lg border border-primary/5 w-fit">
                                        <Mail size={10} className="text-primary opacity-60" />
                                        <p className="text-[9px] font-black text-primary uppercase tracking-wider leading-none">{u.email}</p>
                                        <div className="w-[1px] h-3 bg-primary/10 ml-1" />
                                        <button 
                                          onClick={(e) => { 
                                            e.stopPropagation(); 
                                            navigator.clipboard.writeText(u.email);
                                          }}
                                          title="Copy Login ID"
                                          className="p-1 hover:bg-primary/10 rounded transition-colors"
                                        >
                                          <Copy size={8} className="text-primary opacity-40 group-hover:opacity-100" />
                                        </button>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <ShieldCheck size={8} className="text-green-500" />
                                        <p className="text-[8px] font-bold opacity-30 uppercase tracking-tight">Identity: Firebase Verified</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex gap-4 sm:gap-12 items-center justify-between md:justify-end">
                                  <div className="text-center md:text-right">
                                    <p className="text-[8px] font-black uppercase opacity-30">Collections</p>
                                    <p className="text-xs font-black text-primary">{userRecipes.length} Saved</p>
                                  </div>
                                  <div className="text-center md:text-right">
                                    <p className="text-[8px] font-black uppercase opacity-30">Last Seen</p>
                                    <p className="text-xs font-bold">{new Date(u.lastLogin || u.createdAt).toLocaleDateString()}</p>
                                  </div>
                                  <div className="p-2 rounded-full bg-primary/10 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ChevronRight size={16} />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </motion.div>
                  )}

                  {adminTab === 'User Focus' && selectedAdminUser && (
                    <motion.div key="focus" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
                       <button 
                        onClick={() => {
                          setSelectedAdminUser(null);
                          setAdminTab('Users');
                        }}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity"
                       >
                         <ArrowRight size={14} className="rotate-180" /> Back to User List
                       </button>

                       <div className="p-8 glass rounded-[40px] border border-primary/20 bg-primary/5 flex flex-col md:flex-row gap-8 items-center text-center md:text-left">
                          <div className="w-24 h-24 rounded-[32px] bg-primary text-white flex items-center justify-center text-4xl font-black shadow-2xl">
                            {selectedAdminUser.name?.[0].toUpperCase()}
                          </div>
                          <div className="flex-1 space-y-2">
                             <h3 className="text-3xl font-black">{selectedAdminUser.name}</h3>
                             <div className="flex flex-wrap justify-center md:justify-start gap-4">
                               <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-xl text-primary border border-primary/10">
                                 <Mail size={14} />
                                 <span className="text-sm font-black uppercase tracking-tight">{selectedAdminUser.email}</span>
                               </div>
                               <p className="text-xs font-bold opacity-60 flex items-center gap-1 bg-black/5 dark:bg-white/5 px-3 py-1.5 rounded-xl"><Calendar size={12} /> Joined {new Date(selectedAdminUser.createdAt || Date.now()).toLocaleDateString()}</p>
                             </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-white/10 dark:bg-black/20 rounded-3xl text-center min-w-[100px]">
                              <p className="text-2xl font-black text-primary">{adminData?.recipes?.filter(r => r.user_id === selectedAdminUser.uid).length || 0}</p>
                              <p className="text-[8px] font-black uppercase opacity-40">Saved</p>
                            </div>
                            <div className="p-4 bg-white/10 dark:bg-black/20 rounded-3xl text-center min-w-[100px]">
                              <p className="text-xs font-black opacity-30 break-all leading-none">{selectedAdminUser.uid.substring(0, 8)}...</p>
                              <p className="text-[8px] font-black uppercase opacity-40 mt-2">UID</p>
                            </div>
                          </div>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <h4 className="text-xs font-black uppercase tracking-widest opacity-40 flex items-center gap-2">
                               <Bookmark size={14} /> Saved Recipes
                            </h4>
                            <div className="space-y-4">
                              {adminData?.recipes?.filter(r => r.user_id === selectedAdminUser.uid).map((r: any, i: number) => (
                                <div key={i} className="p-5 glass rounded-3xl border border-white/5">
                                  <div className="flex justify-between items-start mb-2">
                                    <p className="font-extrabold text-sm">{r.name}</p>
                                    <span className="text-[8px] font-black uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-lg">{r.type}</span>
                                  </div>
                                  <p className="text-[10px] opacity-50 line-clamp-2 leading-relaxed">{r.ingredients?.join(", ")}</p>
                                </div>
                              ))}
                              {adminData?.recipes?.filter(r => r.user_id === selectedAdminUser.uid).length === 0 && (
                                <p className="text-center py-8 text-xs font-bold opacity-30 italic">No recipes saved yet.</p>
                              )}
                            </div>
                          </div>

                          <div className="space-y-6">
                            <h4 className="text-xs font-black uppercase tracking-widest opacity-40 flex items-center gap-2">
                               <Star size={14} /> Submitted Feedback
                            </h4>
                            <div className="space-y-4">
                              {adminData?.feedback?.filter(f => f.email === selectedAdminUser.email || f.user_id === selectedAdminUser.uid).map((f: any, i: number) => (
                                <div key={i} className="p-6 glass rounded-3xl border border-yellow-500/10">
                                  <div className="flex justify-between items-center mb-3">
                                    <div className="flex gap-0.5 text-primary">
                                      {[...Array(5)].map((_, j) => <Star key={j} size={10} fill={j < f.rating ? "currentColor" : "none"} />)}
                                    </div>
                                    <span className="text-[8px] font-bold opacity-30">{new Date(f.timestamp).toLocaleDateString()}</span>
                                  </div>
                                  <p className="text-xs font-bold italic leading-relaxed opacity-80">"{f.message}"</p>
                                </div>
                              ))}
                              {adminData?.feedback?.filter(f => f.email === selectedAdminUser.email || f.user_id === selectedAdminUser.uid).length === 0 && (
                                <p className="text-center py-8 text-xs font-bold opacity-30 italic">No feedback provided.</p>
                              )}
                            </div>
                          </div>
                       </div>
                    </motion.div>
                  )}

                  {adminTab === 'Recipes' && (
                    <motion.div key="re" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                      <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary opacity-50" size={18} />
                          <input 
                            type="text" 
                            placeholder="Search recipes or ingredients..."
                            value={adminSearch}
                            onChange={(e) => setAdminSearch(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 glass rounded-2xl border border-transparent focus:border-primary outline-none transition-all font-bold text-sm"
                          />
                        </div>
                        <div className="flex gap-2 p-1 bg-black/5 dark:bg-white/5 rounded-2xl overflow-x-auto no-scrollbar">
                          {['All', 'Veg', 'Non-Veg', 'Eggitarian', 'Balanced'].map((f) => (
                            <button
                              key={f}
                              onClick={() => setAdminTypeFilter(f)}
                              className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${adminTypeFilter === f ? 'bg-primary text-white' : 'opacity-40 hover:opacity-100'}`}
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(adminData?.recipes || [])
                          .filter(r => (adminTypeFilter === 'All' || r.type === adminTypeFilter) && 
                                       (r.name?.toLowerCase().includes(adminSearch.toLowerCase()) || r.ingredients?.some((i: string) => i.toLowerCase().includes(adminSearch.toLowerCase()))))
                          .map((r: any, i: number) => (
                          <div key={i} className="p-5 glass rounded-3xl space-y-4 relative overflow-hidden group border border-transparent hover:border-primary/20 transition-all">
                            <div className="flex justify-between items-start">
                              <h5 className="font-extrabold pr-8 leading-tight">{r.name}</h5>
                              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-primary/10 text-primary">
                                {r.type}
                              </span>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              {r.ingredients?.slice(0, 4).map((ing: string, j: number) => (
                                <span key={j} className="text-[8px] font-bold opacity-50 px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 uppercase">
                                  {ing}
                                </span>
                              ))}
                              {r.ingredients?.length > 4 && <span className="text-[8px] font-bold opacity-30 italic">+{r.ingredients.length - 4} more</span>}
                            </div>
                            <div className="pt-3 border-t border-black/5 dark:border-white/5 flex justify-between items-center text-[10px]">
                              <span className="opacity-40 font-bold uppercase truncate max-w-[120px]">UID: {r.user_id}</span>
                              <span className="font-black text-primary">{new Date(r.savedAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {adminTab === 'Feedback' && (
                    <motion.div key="fe" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                      <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary opacity-50" size={18} />
                          <input 
                            type="text" 
                            placeholder="Search feedback messages or emails..."
                            value={adminSearch}
                            onChange={(e) => setAdminSearch(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 glass rounded-2xl border border-transparent focus:border-primary outline-none transition-all font-bold text-sm"
                          />
                        </div>
                        <div className="flex gap-2 p-1 bg-black/5 dark:bg-white/5 rounded-2xl">
                          {[0, 5, 4, 3, 2, 1].map((rating) => (
                            <button
                              key={rating}
                              onClick={() => setAdminRatingFilter(rating)}
                              className={`w-10 h-10 rounded-xl text-[10px] font-black transition-all flex items-center justify-center ${adminRatingFilter === rating ? 'bg-primary text-white' : 'opacity-40 hover:opacity-100'}`}
                            >
                              {rating === 0 ? 'ALL' : rating}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        {(adminData?.feedback || [])
                          .filter(f => (adminRatingFilter === 0 || f.rating === adminRatingFilter) && 
                                       (f.message?.toLowerCase().includes(adminSearch.toLowerCase()) || f.email?.toLowerCase().includes(adminSearch.toLowerCase())))
                          .map((f: any, i: number) => (
                        <div key={i} className="p-8 glass rounded-[40px] space-y-4 relative overflow-hidden group border border-transparent hover:border-primary/20 transition-all">
                          <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
                            <UtensilsCrossed size={80} />
                          </div>
                          <div className="flex justify-between items-center relative z-10">
                            <div className="flex gap-1 text-primary">
                              {[...Array(5)].map((_, i) => <Star key={i} size={16} fill={i < f.rating ? "currentColor" : "none"} />)}
                            </div>
                            <span className="text-[10px] font-black opacity-30 uppercase tracking-[0.2em]">{new Date(f.timestamp).toLocaleString()}</span>
                          </div>
                          <p className="text-lg font-black leading-relaxed italic pr-12 relative z-10">
                            "{f.message || "The user left a silent high-five!"}"
                          </p>
                          <div className="flex items-center gap-3 pt-4 relative z-10">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary">
                              {f.email?.[0].toUpperCase()}
                            </div>
                            <div>
                               <p className="text-[10px] font-black uppercase tracking-widest">{f.email}</p>
                               <p className="text-[8px] font-bold opacity-40 uppercase">User Feedback Submission</p>
                            </div>
                          </div>
                        </div>
                      ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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

                {/* Diet Selection - Moved to Bottom */}
                <div className="sm:col-span-3 mt-8 mb-6 flex flex-col items-center gap-4 pt-8 border-t border-black/5 dark:border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Select Diet & Nutrition Goal</p>
                  <div className="flex flex-wrap justify-center gap-3">
                    {DIETARY_GOALS.map((goal) => (
                      <button
                        key={goal.name}
                        onClick={() => setDietaryGoal(goal.name)}
                        className={`px-6 py-4 rounded-[32px] border-2 transition-all flex flex-col items-center gap-4 ${
                          dietaryGoal === goal.name 
                            ? 'bg-primary border-primary text-white shadow-lg scale-105' 
                            : (isDarkMode ? 'bg-white/5 border-white/10 hover:border-primary/50' : 'bg-white border-gray-100 hover:border-primary/50')
                        }`}
                      >
                        <div className="text-center">
                          <p className="text-xs font-black leading-none mb-1">{goal.name}</p>
                          <p className={`text-[8px] font-bold uppercase opacity-50 ${dietaryGoal === goal.name ? 'text-white' : ''}`}>{goal.desc}</p>
                        </div>
                        <span className={`text-xl ${dietaryGoal === goal.name ? 'text-white' : 'text-primary'}`}>{goal.icon}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Cook Section - Moved to Bottom */}
                <div className="sm:col-span-3 flex justify-center mb-8">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleQuickCookNow}
                    disabled={isAnalyzing}
                    className="group relative px-12 py-8 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-[40px] font-black shadow-[0_15px_40px_rgba(249,115,22,0.3)] flex flex-col items-center gap-4 uppercase tracking-wider overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
                    <div className="text-center">
                      <p className="text-sm leading-none">{isAnalyzing ? "Cooking..." : "Quick Cook"}</p>
                      <p className="text-[9px] opacity-70 mt-1">{isAnalyzing ? "AI is thinking" : "What can I cook now?"}</p>
                    </div>
                    <span className="text-4xl">🔥</span>
                    <ChevronRight size={20} className="group-hover:translate-y-1 transition-transform rotate-90" />
                  </motion.button>
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
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-12"
            >
              {/* Goal Insight Dashboard - Visible only when results are present */}
              {result && (
                <div className="bg-primary/5 rounded-[40px] p-8 border-2 border-primary/10 backdrop-blur-sm">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 rounded-3xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
                        {DIETARY_GOALS.find(g => g.name === dietaryGoal)?.icon}
                      </div>
                      <div>
                        <h2 className="text-xl font-black">{dietaryGoal} Plan</h2>
                        <p className="text-xs font-bold uppercase opacity-50 tracking-widest mt-1">AI Curated Nutrition</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <div className="px-5 py-3 rounded-2xl bg-white dark:bg-white/5 border border-black/5 dark:border-white/5">
                        <p className="text-[8px] font-black uppercase opacity-40 mb-1">Avg. Protein</p>
                        <p className="text-lg font-black text-primary">{dietaryGoal === 'Muscle Gain' ? 'High (25g+)' : 'Moderate'}</p>
                      </div>
                      <div className="px-5 py-3 rounded-2xl bg-white dark:bg-white/5 border border-black/5 dark:border-white/5">
                        <p className="text-[8px] font-black uppercase opacity-40 mb-1">Calorie Focus</p>
                        <p className="text-lg font-black text-primary">{dietaryGoal === 'Weight Loss' ? 'Deficit (300-500)' : 'Balanced'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Image Preview Card */}
              {image && (
                <div className="relative group">
                  <motion.div 
                    layoutId="target"
                    className={`relative rounded-[32px] overflow-hidden shadow-2xl bg-gray-200 transition-all duration-500 border-4 border-white dark:border-white/5 ${result ? 'aspect-[21/9] md:h-48' : 'aspect-video md:aspect-[21/9]'}`}
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
    if (recipe.dishImagePrompt && !mainImageUrl && !isGeneratingMain) {
      const loadMainImage = async () => {
        setIsGeneratingMain(true);
        try {
          const url = await generateRecipeImage(recipe.dishImagePrompt, recipe.name);
          setMainImageUrl(url);
        } catch (e) {
          console.error("Main image failed", e);
        } finally {
          setIsGeneratingMain(false);
        }
      };
      loadMainImage();
    }
  }, [recipe.dishImagePrompt, mainImageUrl, isGeneratingMain]);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`rounded-[32px] overflow-hidden border-2 transition-all duration-300 ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-white border-gray-100 shadow-xl'}`}
    >
      {/* Recipe Header Image - Always show it once loaded */}
      <div className={`relative ${isOpen ? 'h-48 md:h-64' : 'h-32 md:h-40'} bg-black/5 dark:bg-white/5 overflow-hidden transition-all duration-500`}>
        {mainImageUrl ? (
          <motion.img 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            src={mainImageUrl} 
            alt={recipe.name} 
            className="w-full h-full object-cover"
          />
        ) : isGeneratingMain ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Sparkles className="text-primary animate-pulse" size={24} />
            <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Visualizing...</span>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <ChefHat className="text-primary/20" size={32} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        
        {/* Actions overlayed on image */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <motion.button 
            whileTap={{ scale: 0.8 }}
            onClick={onShare}
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-primary/20 transition-colors"
          >
            <Share2 size={18} />
          </motion.button>
          <motion.button 
            whileTap={{ scale: 0.8 }}
            onClick={onFavorite}
            className={`w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center transition-colors ${isFavorite ? 'text-primary' : 'text-white hover:text-primary'}`}
          >
            {isFavorite ? <BookmarkCheck size={18} className="fill-primary" /> : <Bookmark size={18} />}
          </motion.button>
        </div>

        <div className={`absolute bottom-4 left-6 right-6 transition-all ${isOpen ? 'translate-y-0' : 'translate-y-1'}`}>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/80 text-white backdrop-blur-sm">
                {recipe.type}
              </span>
              {recipe.nutrition && (
                <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-orange-500/80 text-white backdrop-blur-sm">
                  {recipe.nutrition.calories} kcal
                </span>
              )}
              {isFavorite && (
                <motion.span 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="bg-green-500/80 text-white text-[8px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-sm"
                >
                  <CheckCircle2 size={10} /> SAVED
                </motion.span>
              )}
            </div>
            <h3 className={`${isOpen ? 'text-2xl' : 'text-lg'} font-black text-white leading-tight drop-shadow-lg truncate`}>
              {recipe.name}
            </h3>
          </div>
        </div>
      </div>

      <div className="p-8">
        {!isOpen && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-wrap gap-2">
              {recipe.cookingTime && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-black uppercase">
                  <Clock size={12} /> {recipe.cookingTime}
                </div>
              )}
              {recipe.nutrition && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] font-black uppercase">
                  <Star size={10} className="fill-orange-500" /> {recipe.nutrition.calories} kcal
                </div>
              )}
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest opacity-40">
              {recipe.ingredients.length} Items
            </div>
          </div>
        )}

        {isOpen && (
           <div className="flex flex-col gap-4 mb-6">
            {recipe.nutrition && (
              <div className="bg-primary/5 rounded-[24px] p-6 border border-primary/10">
                <p className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-40">Nutritional Facts (Per Serving)</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div className="flex flex-col">
                    <span className="text-xl font-black text-primary">{recipe.nutrition.calories}</span>
                    <span className="text-[9px] font-bold uppercase opacity-50">Calories</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-lg font-black">{recipe.nutrition.protein}</span>
                    <span className="text-[9px] font-bold uppercase opacity-50">Protein</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-lg font-black">{recipe.nutrition.carbs}</span>
                    <span className="text-[9px] font-bold uppercase opacity-50">Carbs</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-lg font-black">{recipe.nutrition.fat}</span>
                    <span className="text-[9px] font-bold uppercase opacity-50">Fat</span>
                  </div>
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
