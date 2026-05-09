import React from 'react';

export default function SocialButton({ provider, svgPath }) {
  return (
    <button type="button" className="flex items-center justify-center gap-3 py-4 px-4 bg-surface-container-highest/30 hover:bg-surface-container-highest/60 border border-white/5 rounded-2xl transition-all duration-300 group">
      <svg className="w-5 h-5 fill-current text-on-surface/80 group-hover:text-on-surface transition-colors" viewBox="0 0 24 24">
        <path d={svgPath}></path>
      </svg>
      <span className="text-sm font-bold">{provider}</span>
    </button>
  );
}