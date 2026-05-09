import React from 'react';

export default function Logo() {
  return (
    <div className="flex items-center gap-3 group cursor-default">
      <div className="w-11 h-11 bg-primary-container rounded-xl flex items-center justify-center shadow-2xl shadow-primary-container/20 group-hover:scale-105 transition-transform duration-300">
        <span className="material-symbols-outlined text-on-primary-container text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
          architecture
        </span>
      </div>
      <span className="text-2xl font-extrabold tracking-tight text-on-surface">
        The Kinetic Architect
      </span>
    </div>
  );
}