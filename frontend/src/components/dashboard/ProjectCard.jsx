import React from 'react';

export default function ProjectCard({ title, lastEdited, imageUrl, isActive }) {
  return (
    <div className="card-hover-trigger relative group bg-surface-container-low rounded-xl overflow-hidden flex flex-col transition-all duration-300">
      <div className="relative aspect-video overflow-hidden">
        <img src={imageUrl} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        
        {/* Hover Actions (Edit, Copy, Delete) */}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-3 hover-actions">
          <button className="p-3 bg-surface-container-highest rounded-full text-on-surface hover:bg-primary-container hover:text-on-primary-container transition-colors shadow-2xl">
            <span className="material-symbols-outlined">edit</span>
          </button>
          <button className="p-3 bg-surface-container-highest rounded-full text-on-surface hover:bg-primary-container hover:text-on-primary-container transition-colors shadow-2xl">
            <span className="material-symbols-outlined">content_copy</span>
          </button>
          <button className="p-3 bg-surface-container-highest rounded-full text-on-surface hover:bg-error-container hover:text-on-error-container transition-colors shadow-2xl">
            <span className="material-symbols-outlined">delete</span>
          </button>
        </div>
      </div>
      
      <div className="p-5">
        <div className="flex justify-between items-start mb-1">
          <h3 className="text-on-surface font-semibold text-lg">{title}</h3>
          {isActive && (
            <span className="px-2 py-0.5 bg-primary-container/10 text-primary text-[0.65rem] font-bold uppercase tracking-widest rounded">Active</span>
          )}
        </div>
        <p className="technical-label">{lastEdited}</p>
      </div>
    </div>
  );
}