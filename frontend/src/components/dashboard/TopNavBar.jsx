import React from 'react';

export default function TopNavBar({ onLogout, userEmail }) {
  return (
    <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-[#131313] font-inter antialiased tracking-tight">
      <div className="flex items-center gap-8">
        <span className="text-xl font-bold text-[#e5e2e1]">The Kinetic Architect</span>
      </div>
      
      <div className="flex-1 max-w-xl px-8">
        <div className="relative flex items-center">
          <span className="material-symbols-outlined absolute left-3 text-on-surface-variant">search</span>
          <input 
            type="text" 
            placeholder="Search projects..." 
            className="w-full bg-surface-container-highest border-none rounded-md py-2 pl-10 pr-4 focus:ring-1 focus:ring-primary/40 text-on-surface placeholder:text-on-surface-variant text-sm outline-none" 
          />
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 mr-4">
          <button className="text-[#c1c6d7] hover:bg-[#353534] p-2 rounded-md transition-colors duration-200">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button className="text-[#c1c6d7] hover:bg-[#353534] p-2 rounded-md transition-colors duration-200">
            <span className="material-symbols-outlined">settings</span>
          </button>
        </div>
        <div className="flex items-center gap-3">
          {userEmail && <span className="text-on-surface-variant text-xs hidden lg:block">{userEmail}</span>}
          <button 
            onClick={onLogout}
            className="px-4 py-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest rounded-lg text-sm font-medium transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
            Çıkış
          </button>
          <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-sm">
            {userEmail ? userEmail[0].toUpperCase() : 'U'}
          </div>
        </div>
      </div>
    </header>
  );
}