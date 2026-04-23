import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary'
}: ConfirmationModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="apple-card-elevated max-w-sm w-full p-10 border border-white/5 relative overflow-hidden"
          >
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 text-apple-text-tertiary hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center mb-8",
                variant === 'danger' ? "bg-apple-error/10 text-apple-error" : 
                variant === 'warning' ? "bg-apple-warning/10 text-apple-warning" : 
                "bg-teal/10 text-teal"
              )}>
                <AlertTriangle size={32} />
              </div>

              <h3 className="text-headline font-bold mb-4">{title}</h3>
              <p className="text-apple-text-secondary text-body mb-10 leading-relaxed">
                {message}
              </p>

              <div className="flex flex-col w-full gap-4">
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className={cn(
                    "h-14 rounded-2xl font-bold transition-all duration-300",
                    variant === 'danger' ? "bg-apple-error text-white hover:bg-apple-error/90" : 
                    "bg-teal text-black hover:shadow-[0_0_20px_rgba(0,128,128,0.3)]"
                  )}
                >
                  {confirmText}
                </button>
                <button
                  onClick={onClose}
                  className="h-14 rounded-2xl bg-white/5 text-apple-text-tertiary font-bold hover:bg-white/10 transition-all"
                >
                  {cancelText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
