import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChefHat, Mail, Lock, User, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { auth } from "../lib/firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile 
} from "firebase/auth";

interface AuthScreenProps {
  onAuthSuccess: (user: any) => void;
  isDarkMode: boolean;
}

export function AuthScreen({ onAuthSuccess, isDarkMode }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (mode === "signup") {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        onAuthSuccess({
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          name: name
        });
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        onAuthSuccess({
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          name: userCredential.user.displayName || userCredential.user.email
        });
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      let msg = err.message;
      if (err.code === "auth/user-not-found") msg = "No account found with this email. Please sign up!";
      if (err.code === "auth/wrong-password") msg = "Incorrect password. Please try again.";
      if (err.code === "auth/email-already-in-use") msg = "This email is already registered.";
      if (err.code === "auth/invalid-credential") msg = "Invalid email or password.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 ${isDarkMode ? 'bg-bg-dark text-white' : 'bg-bg-light text-gray-900'}`}>
      {/* Debug Info (Only in console) */}
      <script dangerouslySetInnerHTML={{ __html: `console.log("API Base:", window.location.origin);` }} />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full relative z-10"
      >
        <div className="flex flex-col items-center mb-10">
          <motion.div 
            whileHover={{ scale: 1.1, rotate: 10 }}
            className="w-20 h-20 bg-primary rounded-[24px] flex items-center justify-center shadow-2xl mb-6"
          >
            <ChefHat size={40} className="text-white" />
          </motion.div>
          <h1 className="text-4xl font-black tracking-tight mb-2">
            Cook<span className="text-primary italic">Genix</span>
          </h1>
          <p className="text-sm font-medium opacity-60">Your AI Kitchen Companion</p>
        </div>

        <div className={`glass p-8 rounded-[40px] shadow-2xl border border-white/10 ${isDarkMode ? 'bg-white/5' : 'bg-white/80'}`}>
          <div className="flex gap-2 p-1 bg-black/5 dark:bg-white/5 rounded-2xl mb-8">
            <button 
              onClick={() => setMode("login")}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-black transition-all ${mode === 'login' ? 'bg-primary text-white shadow-lg' : 'opacity-50 hover:opacity-100'}`}
            >
              LOG IN
            </button>
            <button 
              onClick={() => setMode("signup")}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-black transition-all ${mode === 'signup' ? 'bg-primary text-white shadow-lg' : 'opacity-50 hover:opacity-100'}`}
            >
              SIGN UP
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {mode === "signup" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4"
                >
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={18} />
                    <input 
                      type="text" 
                      placeholder="Full Name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-transparent focus:border-primary outline-none transition-all text-sm font-bold"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={18} />
              <input 
                type="email" 
                placeholder="Email Address"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-transparent focus:border-primary outline-none transition-all text-sm font-bold"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={18} />
              <input 
                type="password" 
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-transparent focus:border-primary outline-none transition-all text-sm font-bold"
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3"
                >
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <p className="text-xs font-bold text-red-500">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              disabled={isLoading}
              className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-xl hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 group"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  {mode === 'login' ? 'Let\'s Cook' : 'Create Account'}
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-30">
              <Sparkles size={12} />
              Secured by CookGenix AI
              <Sparkles size={12} />
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-xs font-bold opacity-40">
          By continuing, you agree to CookGenix's <span className="text-primary hover:underline cursor-pointer">Terms</span> and <span className="text-primary hover:underline cursor-pointer">Privacy Policy</span>.
        </p>
      </motion.div>
    </div>
  );
}
