import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, X, Bot, User, Loader2, Link2 } from 'lucide-react';
import { chatWithAssistant } from '../lib/gemini';
import { UserProfile, TaxAnalysisResult } from '../types';
import { cn } from '../lib/utils';

export default function Assistant({ 
  profile, 
  discovery,
  onClose, 
  isOnline 
}: { 
  profile: UserProfile, 
  discovery: TaxAnalysisResult | null,
  onClose: () => void, 
  isOnline: boolean 
}) {
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([
    { role: 'model', text: 'I am your TaxBreaker Advisor. How may I assist with your Indian tax optimization for FY 2024-25?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOnline) {
      setMessages(prev => [...prev, { role: 'model', text: 'NOTE: Device is currently offline. Intelligence core connection is suspended.' }]);
    }
  }, [isOnline]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    if (!isOnline) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
      
      const response = await chatWithAssistant({ ...profile, discovery }, history, userMsg);
      setMessages(prev => [...prev, { role: 'model', text: response || 'An unexpected interruption occurred in the logic stream.' }]);
    } catch (error) {
       setMessages(prev => [...prev, { role: 'model', text: 'Connection to the intelligence core is temporarily suspended.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.98 }}
      className="fixed bottom-24 right-8 w-full md:w-[450px] h-[70vh] apple-card-elevated flex flex-col z-[60] overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,1)] border-white/5 p-0"
    >
      <div className="px-8 py-8 border-b border-white/5 flex items-center justify-between bg-apple-black">
         <div className="flex items-center gap-4">
            <div className={cn(
              "w-2 h-2 rounded-full animate-pulse transition-colors duration-500",
              isOnline ? "bg-apple-success shadow-[0_0_12px_rgba(48,209,88,0.4)]" : "bg-apple-warning shadow-[0_0_12px_rgba(255,159,10,0.4)]"
            )} />
            <div>
              <p className="text-caption font-bold uppercase tracking-[0.2em] text-gold">Premium Concierge</p>
              <p className="text-caption text-apple-text-tertiary font-medium">
                {isOnline ? 'End-to-end Encryption Active' : 'Offline Mode Active'}
              </p>
            </div>
         </div>
         <button onClick={onClose} className="p-2 text-apple-text-tertiary hover:text-white transition-colors">
            <X className="w-5 h-5" />
         </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-10 space-y-12 scroll-smooth bg-apple-black/40">
         {messages.map((m, i) => (
           <div key={i} className={cn(
             "px-4",
             m.role === 'user' ? "text-right" : "text-left"
           )}>
             <span className="text-caption font-bold uppercase tracking-widest mb-3 block text-apple-text-tertiary">
               {m.role === 'user' ? 'Client' : 'Advisor'}
             </span>
             <div className={cn(
               "inline-block max-w-[90%] text-body font-normal leading-relaxed",
               m.role === 'user' ? "text-white" : "text-apple-text-secondary"
             )}>
               {m.text}
             </div>
           </div>
         ))}
         {loading && (
           <div className="px-4">
             <span className="text-caption font-bold uppercase tracking-widest mb-3 block text-apple-text-tertiary">Advisor</span>
             <div className="flex gap-2">
               <motion.div animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-1.5 h-1.5 rounded-full bg-gold" />
               <motion.div animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-gold" />
               <motion.div animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-gold" />
             </div>
           </div>
         )}
      </div>

      <div className="p-12 bg-apple-black border-t border-white/5">
         <div className="relative">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isOnline ? "Ask a technical tax question..." : "Intelligence Hub (OFFLINE)"}
              disabled={!isOnline}
              className="w-full bg-transparent border-b border-white/10 h-12 px-0 outline-none focus:border-gold transition-all font-normal text-body placeholder:text-apple-text-tertiary disabled:opacity-50"
            />
            <button 
              onClick={handleSend}
              className={cn(
                "absolute right-0 top-3 text-apple-text-tertiary transition-all",
                input.trim() ? "text-gold opacity-100" : "opacity-0 invisible"
              )}
            >
              <Send className="w-5 h-5" />
            </button>
         </div>
      </div>
    </motion.div>
  );
}
