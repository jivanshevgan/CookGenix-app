import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChefHat, Mail, Lock, User, Phone, ArrowRight, Loader2, Sparkles, X, CheckCircle2 } from "lucide-react";
import { auth, googleProvider, RecaptchaVerifier } from "../firebase";
import { signInWithPopup, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";

interface AuthScreenProps {
  onAuthSuccess: (user: any, token: string) => void;
  isDarkMode: boolean;
}

export function AuthScreen({ onAuthSuccess, isDarkMode }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Phone Auth State
  const [phoneStep, setPhoneStep] = useState<"input" | "otp">("input");
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [otp, setOtp] = useState("");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    phoneNumber: ""
  });

  // Sync social login with local DB
  const syncSocialUser = async (firebaseUser: any) => {
    try {
      const response = await fetch("/api/auth/social-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName,
          phoneNumber: firebaseUser.phoneNumber,
          photoURL: firebaseUser.photoURL
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onAuthSuccess(data.user, data.token);
    } catch (err: any) {
      setError("Social Sync Failed: " + err.message);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await syncSocialUser(result.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const setupRecaptcha = (containerId: string) => {
    if ((window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier.clear();
    }
    (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: "invisible",
      callback: () => {
        console.log("Recaptcha resolved");
      }
    });
    return (window as any).recaptchaVerifier;
  };

  const handlePhoneLoginInit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.phoneNumber) return;
    setLoading(true);
    setError(null);
    try {
      const verifier = setupRecaptcha("phone-recaptcha-anchor");
      const result = await signInWithPhoneNumber(auth, formData.phoneNumber, verifier);
      setConfirmationResult(result);
      setPhoneStep("otp");
    } catch (err: any) {
      setError("SMS Failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult || !otp) return;
    setLoading(true);
    setError(null);
    try {
      const result = await confirmationResult.confirm(otp);
      await syncSocialUser(result.user);
      setShowPhoneModal(false);
    } catch (err: any) {
      setError("OTP Failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/signup";
    
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      onAuthSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 ${isDarkMode ? "bg-bg-dark text-white" : "bg-bg-light text-gray-900"}`}>
      <div id="phone-recaptcha-anchor"></div>
      
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-4">
          <motion.div 
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            className="w-20 h-20 bg-primary rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-primary/30"
          >
            <ChefHat size={40} className="text-white" />
          </motion.div>
          
          <div className="space-y-1">
            <h1 className="text-4xl font-black italic tracking-tight">
              Cook<span className="text-primary">Genix</span>
            </h1>
            <p className="text-gray-500 font-medium">
              {isLogin ? "Welcome back, Chef!" : "Join the creative kitchen"}
            </p>
          </div>
        </div>

        <motion.div 
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative glass p-8 rounded-[40px] shadow-2xl border-2 border-white/10"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest opacity-50 ml-2">Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        required
                        type="text" 
                        placeholder="Master Chef"
                        className="w-full pl-12 pr-4 py-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-primary transition-colors outline-none font-bold shadow-inner"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest opacity-50 ml-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  required
                  type="email" 
                  placeholder="chef@cookgenix.com"
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-primary transition-colors outline-none font-bold shadow-inner"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest opacity-50 ml-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  required
                  type="password" 
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-primary transition-colors outline-none font-bold shadow-inner"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </div>

            {error && (
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-500 text-xs font-bold text-center bg-red-500/10 py-2 rounded-lg"
              >
                {error}
              </motion.p>
            )}

            <button 
              disabled={loading}
              className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-lg disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" /> : (
                <>
                  {isLogin ? "Login" : "Sign Up"}
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center space-y-4">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-xs font-bold text-gray-400 hover:text-primary transition-colors uppercase tracking-widest"
            >
              {isLogin ? "Don't have an account? Sign Up" : "Already a chef? Log In"}
            </button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full h-px bg-black/5 dark:bg-white/10"></div></div>
              <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest text-gray-400">
                <span className="px-4 bg-white dark:bg-bg-dark rounded-full">Or continue with</span>
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={handleGoogleLogin}
                type="button" 
                className="flex-1 py-4 px-6 bg-white dark:bg-white/5 text-gray-900 dark:text-white rounded-2xl font-black shadow-md border border-gray-100 dark:border-white/10 flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
                title="Google Login"
              >
                <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
                Google
              </button>
              <button 
                onClick={() => setShowPhoneModal(true)}
                type="button" 
                className="flex-1 py-4 px-6 bg-white dark:bg-white/5 text-gray-900 dark:text-white rounded-2xl font-black shadow-md border border-gray-100 dark:border-white/10 flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
                title="Phone Login"
              >
                <Phone size={16} className="text-secondary" />
                Phone
              </button>
            </div>
          </div>
        </motion.div>

        <div className="text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center justify-center gap-2">
            <Sparkles size={10} className="text-primary" />
            Complete Auth with JSON Data Storage
          </p>
        </div>
      </div>

      {/* Phone OTP Modal */}
      <AnimatePresence>
        {showPhoneModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md"
          >
             <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className={`max-w-md w-full p-8 rounded-[40px] glass shadow-2xl relative ${isDarkMode ? "bg-bg-dark text-white" : "bg-white text-gray-900"}`}
            >
              <button onClick={() => setShowPhoneModal(false)} className="absolute top-6 right-6 p-2"><X size={20} /></button>
              
              <h3 className="text-2xl font-black italic mb-6">Phone <span className="text-primary">Verification</span></h3>

              <form onSubmit={phoneStep === "input" ? handlePhoneLoginInit : handleOtpVerify} className="space-y-6">
                {phoneStep === "input" ? (
                  <div className="space-y-4">
                    <p className="text-sm font-medium opacity-60 italic">Enter your mobile number with country code (e.g., +91)</p>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        required
                        type="tel" 
                        placeholder="+91 12345 67890"
                        className="w-full pl-12 pr-4 py-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-primary transition-colors outline-none font-bold shadow-inner"
                        value={formData.phoneNumber}
                        onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-primary bg-primary/10 p-4 rounded-2xl border border-primary/20">
                      <CheckCircle2 size={24} />
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest">Code Sent</p>
                        <p className="text-sm font-bold">{formData.phoneNumber}</p>
                      </div>
                    </div>
                    <input 
                      required
                      type="text" 
                      placeholder="6-digit code"
                      className="w-full p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-primary transition-colors outline-none font-bold text-center text-2xl tracking-[0.5em] shadow-inner"
                      value={otp}
                      onChange={e => setOtp(e.target.value)}
                    />
                  </div>
                )}

                <button 
                  disabled={loading}
                  className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" /> : (
                    phoneStep === "input" ? "Send verification code" : "Verify & Start Cooking"
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
