import * as React from 'react';
import { cn } from '../lib/utils';

export function SectionHeader({ title, icon }: { title: string, icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      <div className="p-2 bg-gold/10 text-gold rounded-lg">{icon}</div>
      <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white/60">{title}</h2>
    </div>
  );
}

export function NavLink({ children, active, onClick }: { children: React.ReactNode, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "small-caps transition-all duration-700 relative py-2 text-[11px]",
        active ? "text-gold" : "text-white/30 hover:text-white"
      )}
    >
      {children}
    </button>
  );
}
