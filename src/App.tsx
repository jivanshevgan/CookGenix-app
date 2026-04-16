import { useState, useRef, type ChangeEvent, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Camera, ChefHat, Sparkles, UtensilsCrossed, RefreshCcw, 
  CheckCircle2, ChevronRight, Info, X, Zap, RotateCcw, 
  Image as ImageIcon, Moon, Sun, Heart, Share2, History, Home, 
  Plus
} from "lucide-react";
import { analyzeFridgeImage, type AnalysisResponse, type Recipe } from "./lib/gemini";

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("environment");
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Persistence for dark mode
  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode") === "true";
    setIsDarkMode(savedMode);
    if (savedMode) document.documentElement.classList.add("dark");
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem("darkMode", newMode.toString());
    if (newMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API not supported in this browser.");
      }
      
      const constraints = {
        video: { 
          facingMode: { ideal: cameraFacing },
          width: { ideal: 1080 },
          height: { ideal: 1920 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Ensure video element is ready
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (e) {
          console.error("Video play failed:", e);
        }
      }

      setError(null);
    } catch (err: any) {
      console.error("Camera error:", err);
      setIsCameraOpen(false);
      
      let msg = "Camera access denied.";
      if (err.name === 'NotAllowedError') msg = "Permission Denied: Please allow camera access in your browser settings.";
      if (err.name === 'NotFoundError') msg = "Camera not found on this device.";
      
      setError(msg);
      setShowPermissionHelp(true);
    }
  };

  useEffect(() => {
    if (isCameraOpen) {
      startCamera();
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraFacing, isCameraOpen]);

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg");
        setImage(dataUrl);
        stopCamera();
      }
    }
  };

  const switchCamera = () => {
    setCameraFacing(prev => prev === "user" ? "environment" : "user");
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
    setIsAnalyzing(true);
    setError(null);
    try {
      const [mimeTypePart, base64Data] = image.split(",");
      const mimeType = mimeTypePart.match(/:(.*?);/)?.[1] || "image/jpeg";
      const data = await analyzeFridgeImage(base64Data, mimeType);
      setResult(data);
    } catch (err) {
      console.error(err);
      setError("Something went wrong while analyzing the ingredients. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setImage(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const [showPermissionHelp, setShowPermissionHelp] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PermissionState | 'unknown'>('unknown');

  // Check camera permission status
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'camera' as PermissionName })
        .then((result) => {
          setPermissionStatus(result.state);
          result.onchange = () => setPermissionStatus(result.state);
        })
        .catch(() => setPermissionStatus('unknown'));
    }
  }, []);

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-bg-dark text-white' : 'bg-bg-light text-gray-900'} font-sans selection:bg-primary/30 transition-colors duration-300 pb-24`}>
      {/* Permission Help Modal */}
      <AnimatePresence>
        {showPermissionHelp && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className={`max-w-md w-full p-8 rounded-[32px] glass shadow-2xl relative ${isDarkMode ? 'bg-bg-dark text-white' : 'bg-white text-gray-900'}`}
            >
              <button 
                onClick={() => setShowPermissionHelp(false)}
                className="absolute top-6 right-6 p-2 hover:bg-black/5 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
              
              <h3 className="text-2xl font-black mb-6 flex items-center gap-3 text-primary">
                <Info size={28} />
                Permission Help
              </h3>
              
              <div className="space-y-6 text-sm font-medium leading-relaxed opacity-90">
                <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20 flex flex-col items-center text-center gap-3">
                  <p className="font-black text-primary uppercase tracking-widest text-xs">Best Solution</p>
                  <p className="font-bold">Open this app in a New Tab</p>
                  <p className="text-xs opacity-80">Browsers often block cameras inside previews. Opening in a new tab usually fixes all permission issues instantly.</p>
                  <a 
                    href={window.location.href} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-primary text-white rounded-xl font-black text-center shadow-lg hover:scale-[1.02] transition-transform"
                  >
                    Open in New Tab
                  </a>
                </div>

                <div className="h-px bg-black/5 dark:bg-white/5" />

                <p>If you prefer to stay here, follow these steps:</p>
                
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 text-[10px] font-black">1</div>
                    <p>Look for the <strong>lock icon (🔒)</strong> or camera icon in your browser's address bar and click it.</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 text-[10px] font-black">2</div>
                    <p>Toggle <strong>Camera</strong> and <strong>Pop-ups</strong> to "Allow".</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 text-[10px] font-black">3</div>
                    <p>Refresh the page and try again.</p>
                  </div>
                </div>

                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                  <p className="text-primary font-bold mb-1">Pro-Tip:</p>
                  <p>If "Live Camera" fails, use the <strong>"System Camera"</strong> button. It uses your device's native app which almost always works!</p>
                </div>
              </div>
              
              <button 
                onClick={() => setShowPermissionHelp(false)}
                className="w-full mt-8 py-4 bg-primary text-white font-black rounded-2xl shadow-lg"
              >
                Got it!
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
        
        <button 
          onClick={toggleDarkMode}
          className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}
        >
          {isDarkMode ? <Sun size={20} className="text-primary" /> : <Moon size={20} className="text-gray-600" />}
        </button>
      </nav>

      <main className="max-w-4xl mx-auto px-6 pt-24">
        <AnimatePresence mode="wait">
          {isCameraOpen ? (
            <motion.div
              key="camera"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative rounded-3xl overflow-hidden glass shadow-2xl aspect-[3/4] border-4 border-primary/20"
            >
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              
              <div className="absolute top-6 left-6 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-white uppercase tracking-widest leading-none">Scanning View</span>
              </div>

              <button 
                onClick={stopCamera}
                className="absolute top-6 right-6 w-10 h-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center text-white"
              >
                <X size={20} />
              </button>

              <div className="absolute bottom-12 left-0 right-0 flex justify-center items-center gap-10">
                <button onClick={switchCamera} className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white">
                  <RotateCcw size={20} />
                </button>
                <button 
                  onClick={capturePhoto}
                  className="w-20 h-20 bg-primary rounded-full flex items-center justify-center p-1 shadow-[0_0_30px_rgba(255,122,0,0.5)] active:scale-90 transition-transform"
                >
                  <div className="w-full h-full rounded-full border-4 border-white" />
                </button>
                <div className="w-12" />
              </div>
            </motion.div>
          ) : !image ? (
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

                {/* Experimental In-Browser Camera */}
                <CaptureCard 
                  title="Live View" 
                  desc="In-browser" 
                  icon={<Zap size={24} />} 
                  onClick={() => setIsCameraOpen(true)}
                  isDarkMode={isDarkMode}
                />
              </div>

              {permissionStatus === 'denied' && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-6 mx-4 p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-bold flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Info size={16} />
                    <span>Camera permission is currently blocked</span>
                  </div>
                  <button onClick={() => setShowPermissionHelp(true)} className="underline">How to fix?</button>
                </motion.div>
              )}

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
                  <button 
                    onClick={() => setShowPermissionHelp(true)}
                    className="w-full py-4 glass border-primary/20 text-primary font-bold text-xs uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2"
                  >
                    <Info size={14} /> Troubleshoot Permissions
                  </button>
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
                        <RecipeCard key={index} recipe={recipe} index={index} isDarkMode={isDarkMode} />
                      ))}
                    </div>
                  </div>

                  {/* Extra Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4 justify-center py-10">
                    <button className="flex items-center justify-center gap-3 px-8 py-4 glass rounded-2xl font-bold hover:bg-primary/10 transition-colors">
                      <Heart size={20} /> Save Collection
                    </button>
                    <button className="flex items-center justify-center gap-3 px-8 py-4 glass rounded-2xl font-bold hover:bg-primary/10 transition-colors">
                      <Share2 size={20} /> Share Results
                    </button>
                    <button 
                      onClick={handleReset}
                      className="flex items-center justify-center gap-3 px-8 py-4 bg-primary/10 text-primary rounded-2xl font-bold hover:bg-primary/20 transition-colors"
                    >
                      <RotateCcw size={20} /> Try Another Photo
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Nav */}
      <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-4 glass border border-white/20 rounded-full shadow-2xl flex items-center gap-10 md:gap-16`}>
        <NavButton icon={<Home size={22} />} active />
        <NavButton icon={<History size={22} />} />
        <PlusButton onClick={() => handleReset()} />
        <NavButton icon={<Heart size={22} />} />
        <NavButton icon={<ChevronRight size={22} className="rotate-90" />} />
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

function RecipeCard({ recipe, index, isDarkMode }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const typeIcon = () => {
    if (recipe.type?.toLowerCase().includes("breakfast")) return <div className="text-orange-500"><UtensilsCrossed size={16} /></div>;
    if (recipe.type?.toLowerCase().includes("snack")) return <div className="text-green-500"><Zap size={16} /></div>;
    return <div className="text-blue-500"><ChefHat size={16} /></div>;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`rounded-[32px] overflow-hidden border-2 transition-all duration-300 ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-white border-gray-100 shadow-xl'}`}
    >
      <div className="p-8">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3 px-4 py-2 glass rounded-2xl">
            {typeIcon()}
            <span className="text-[10px] font-black uppercase tracking-widest">{recipe.type}</span>
          </div>
          <motion.button 
            whileTap={{ scale: 0.8 }}
            className="w-10 h-10 rounded-full glass flex items-center justify-center text-primary"
          >
            <Heart size={18} />
          </motion.button>
        </div>

        <h3 className="text-2xl font-black mb-4 leading-tight">{recipe.name}</h3>
        
        <div className="space-y-2 mb-8">
          <p className="text-[10px] font-black text-primary uppercase tracking-widest">Key Ingredients</p>
          <p className="text-sm font-semibold opacity-60 leading-relaxed">
            {recipe.ingredients.join(" • ")}
          </p>
        </div>

        <button 
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full py-4 px-6 rounded-2xl flex items-center justify-between font-bold text-sm transition-colors ${isDarkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-black/5 hover:bg-black/10'}`}
        >
          <span>See Full Recipe</span>
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
              <div className="pt-8 border-t border-white/10 mt-6">
                <p className="text-sm leading-[1.8] font-medium opacity-80 whitespace-pre-line italic">
                  {recipe.method}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function NavButton({ icon, active }: any) {
  return (
    <button className={`p-2 transition-all ${active ? 'text-primary scale-110' : 'text-gray-400 hover:text-primary'}`}>
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
