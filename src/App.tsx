import { useState, useRef, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Camera, ChefHat, Sparkles, UtensilsCrossed, RefreshCcw, CheckCircle2, ChevronRight, Info } from "lucide-react";
import { analyzeFridgeImage, type AnalysisResponse, type Recipe } from "./lib/gemini";

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setError("Arre yaar! Something went wrong while analyzing the photo. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const triggerUpload = () => fileInputRef.current?.click();

  const handleReset = () => {
    setImage(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-cream selection:bg-saffron selection:text-white p-4 md:p-8">
      <header className="max-w-5xl mx-auto mb-10 border-b-4 border-saffron pb-6 flex flex-col md:flex-row justify-between items-baseline gap-4">
        <motion.h1 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-5xl md:text-7xl font-black text-saffron uppercase tracking-tighter"
        >
          Cook<span className="text-chilli">Genix</span>
        </motion.h1>
        
        <motion.div
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           className="inline-flex items-center gap-2 px-4 py-1.5 bg-chilli text-white rounded-full text-sm font-bold shadow-sm"
        >
          <ChefHat size={16} />
          <span className="uppercase">COOKGENIX PRO STATUS: ONLINE</span>
        </motion.div>
      </header>

      <main className="max-w-5xl mx-auto">
        <AnimatePresence mode="wait">
          {!image ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border-4 border-turmeric rounded-3xl p-12 text-center cursor-pointer brutal-shadow hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform"
              onClick={triggerUpload}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />
              <div className="w-20 h-20 bg-cream rounded-full flex items-center justify-center mx-auto mb-6 text-saffron border-2 border-saffron">
                <Camera size={40} />
              </div>
              <h2 className="text-3xl font-black uppercase text-ink mb-2 italic">Upload Fridge Photo</h2>
              <p className="text-gray-500 mb-8 font-medium">Dekho, fridge mein kya hai! Show me the goods.</p>
              <button 
                className="px-10 py-4 bg-ink text-white rounded-xl font-black uppercase tracking-widest hover:bg-saffron transition-colors shadow-lg"
              >
                Choose Image
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12"
            >
              <div className="grid md:grid-cols-2 gap-10 items-start">
                <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-black aspect-[3/4] border-4 border-ink">
                  <img src={image} alt="Target fridge" className="w-full h-full object-cover" />
                  <button 
                    onClick={handleReset}
                    className="absolute top-4 right-4 p-3 bg-chilli/90 backdrop-blur-md rounded-xl text-white hover:bg-chilli transition-colors"
                  >
                    <RefreshCcw size={20} />
                  </button>
                </div>

                <div className="space-y-8">
                  {!result && !isAnalyzing && (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-white rounded-3xl p-8 border-4 border-turmeric brutal-shadow"
                    >
                      <h3 className="text-3xl font-black uppercase text-saffron mb-4">Picture Perfect!</h3>
                      <p className="text-gray-600 font-medium mb-8 leading-relaxed">Ek dum mast photo hai! Shall I start brainstorming some delicious fusion ideas with these ingredients?</p>
                      <button 
                        onClick={handleAnalyze}
                        className="w-full py-5 bg-saffron text-white rounded-2xl font-black text-xl uppercase tracking-tighter flex items-center justify-center gap-3 hover:bg-chilli transition-colors shadow-lg"
                      >
                        <Sparkles size={24} />
                        Get Detailed Recipes
                      </button>
                    </motion.div>
                  )}

                  {isAnalyzing && (
                    <div className="bg-white rounded-3xl p-12 border-4 border-turmeric brutal-shadow flex flex-col items-center justify-center text-center space-y-6">
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                        className="text-chilli"
                      >
                        <ChefHat size={64} />
                      </motion.div>
                      <div>
                        <h3 className="text-2xl font-black uppercase">Chef is thinking...</h3>
                        <p className="text-gray-500 font-bold italic mt-2">"Garma garam recipes soch raha hoon..."</p>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="bg-red-50 border-4 border-chilli text-chilli p-6 rounded-2xl flex items-start gap-4 font-bold shadow-md">
                      <Info className="shrink-0 mt-1" size={24} />
                      <p>{error}</p>
                    </div>
                  )}

                  {result && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-3xl p-8 border-4 border-ink brutal-shadow"
                    >
                      <h3 className="text-xl font-black uppercase mb-4 flex items-center gap-3">
                        <CheckCircle2 size={24} className="text-cilantro" />
                        Found in your fridge:
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {result.identifiedIngredients.map((item, i) => (
                          <span key={i} className="px-3 py-1 bg-turmeric/20 text-ink border-2 border-turmeric rounded-lg text-sm font-black uppercase">
                            {item}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {result && (
                <div className="grid lg:grid-cols-3 gap-8 pt-4">
                  {result.recipes.map((recipe, index) => (
                    <RecipeCard key={`recipe-${index}`} recipe={recipe} index={index} />
                  ))}
                </div>
              )}

              {result && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="bg-ink text-white rounded-2xl p-10 relative overflow-hidden group shadow-2xl"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform text-turmeric">
                    <UtensilsCrossed size={140} />
                  </div>
                  <div className="relative z-10 max-w-2xl">
                    <h4 className="text-2xl font-black uppercase text-turmeric mb-4 flex items-center gap-3 underline underline-offset-8 decoration-saffron">
                      <ChefHat />
                      Chef's Pro Tip (Suno Zara!)
                    </h4>
                    <p className="text-lg font-medium opacity-90 leading-relaxed italic border-l-4 border-saffron pl-6">
                      "{result.chefsTip}"
                    </p>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="max-w-4xl mx-auto mt-20 pb-10 text-center text-gray-400 text-sm">
        <p>© {new Date().getFullYear()} CookGenix AI · Your Smart Kitchen Partner</p>
      </footer>
    </div>
  );
}

interface RecipeCardProps {
  recipe: Recipe;
  index: number;
  key?: string | number;
}

function RecipeCard({ recipe, index }: RecipeCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isHighlight = index === 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 * index }}
      className={`bg-white rounded-3xl p-6 border-3 flex flex-col relative ${
        isHighlight 
          ? 'border-cilantro brutal-shadow-highlight' 
          : 'border-turmeric brutal-shadow'
      }`}
    >
      <div className="absolute -top-3 -right-2 bg-chilli text-white px-3 py-1 rounded-lg font-black text-[10px] uppercase tracking-tighter rotate-6 shadow-md z-10 border border-white/20">
        {index === 0 ? "₹ Cheap & Best" : index === 1 ? "₹ Protein Hit" : "₹ Filling AF"}
      </div>

      <div className="flex justify-between items-start mb-3">
        <span className="text-[9px] uppercase tracking-widest font-black text-white bg-ink px-2 py-0.5 rounded shadow-sm">
          {recipe.type}
        </span>
      </div>
      
      <h3 className="text-2xl font-black text-ink mb-4 leading-tight h-[60px] line-clamp-2 uppercase">
        {recipe.name}
      </h3>
      
      <div className="flex-grow">
        <div className="border-l-3 border-saffron pl-3 mb-6">
          <p className="text-[10px] font-black text-saffron uppercase tracking-tighter mb-1">Found Ingredients:</p>
          <p className="text-sm font-bold text-gray-500 line-clamp-4 leading-snug">
            {recipe.ingredients.join(", ")}
          </p>
        </div>
      </div>

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`mt-4 py-3 px-5 rounded-xl font-black uppercase text-sm tracking-widest flex items-center justify-between group transition-all border-2 ${
          isHighlight 
            ? 'bg-cilantro/10 text-cilantro border-cilantro hover:bg-cilantro hover:text-white' 
            : 'bg-turmeric/10 text-ink border-turmeric hover:bg-turmeric hover:text-white'
        }`}
      >
        <span>Recipe Dekho</span>
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
            <div className="pt-6 space-y-4">
              <div className="p-5 bg-cream/50 rounded-2xl border-2 border-dashed border-gray-300">
                <p className="text-sm font-bold leading-relaxed text-ink italic whitespace-pre-line">
                  {recipe.method}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
