import React from 'react';

export default function SideNavBar() {
  const navLinks = [
    { icon: 'dashboard', label: 'My Sites', active: true },
    { icon: 'web', label: 'Templates' },
    { icon: 'delete', label: 'Trash' },
    { icon: 'settings', label: 'Settings' }
  ];

  return (
    <aside className="fixed left-0 top-0 h-full flex flex-col py-8 px-4 z-40 bg-[#1c1b1b] w-64 mt-16 border-r border-outline-variant/5">
      <div className="mb-8 px-2">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 bg-primary-container rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary-container text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
              architecture
            </span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#e5e2e1]">Workspace</h3>
            <p className="text-[0.6875rem] text-[#c1c6d7] uppercase tracking-wider">Pro Plan</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 space-y-1">
        {navLinks.map((link, index) => (
          <a key={index} href="#" className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 ${link.active ? 'text-[#e5e2e1] bg-[#2a2a2a]' : 'text-[#c1c6d7] hover:bg-[#353534] hover:text-[#e5e2e1] opacity-80 hover:opacity-100'}`}>
            <span className="material-symbols-outlined">{link.icon}</span>
            <span className="text-sm font-inter">{link.label}</span>
          </a>
        ))}
      </nav>
      
      <div className="mt-auto pt-8 border-t border-outline-variant/10 space-y-1">
        <a href="#" className="flex items-center gap-3 px-3 py-2 text-[#c1c6d7] hover:bg-[#353534] hover:text-[#e5e2e1] rounded-md transition-all duration-200 opacity-80 hover:opacity-100">
          <span className="material-symbols-outlined">help_outline</span>
          <span className="text-sm font-inter">Help</span>
        </a>
        <a href="#" className="flex items-center gap-3 px-3 py-2 text-[#c1c6d7] hover:bg-[#353534] hover:text-[#e5e2e1] rounded-md transition-all duration-200 opacity-80 hover:opacity-100">
          <span className="material-symbols-outlined">chat_bubble_outline</span>
          <span className="text-sm font-inter">Feedback</span>
        </a>
      </div>
    </aside>
  );
}