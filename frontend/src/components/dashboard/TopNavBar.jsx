import React from 'react';

export default function TopNavBar() {
  return (
    <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-[#131313] font-inter antialiased tracking-tight">
      <div className="flex items-center gap-8">
        <span className="text-xl font-bold text-[#e5e2e1]">The Kinetic Architect</span>
        <div className="hidden md:flex items-center gap-6">
          <a href="#" className="text-[#4b8eff] border-b-2 border-[#4b8eff] pb-1">Desktop</a>
          <a href="#" className="text-[#c1c6d7] hover:text-[#e5e2e1] transition-colors duration-200">Tablet</a>
          <a href="#" className="text-[#c1c6d7] hover:text-[#e5e2e1] transition-colors duration-200">Mobile</a>
        </div>
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
          <button className="px-4 py-2 bg-primary-container text-on-primary-container rounded-lg font-semibold hover:opacity-90 transition-all scale-95 active:transition-transform">
            Publish
          </button>
          <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuDfovWKyga9JRARF6yPsBCJR-HeB7PSiW5mR9njgA1l1nDre0LXD4OHQtCdjcCOux1dFRT-Rio3Ju4tmkfSUfyrDYuxxO6WGTePLScKon6yidCtSRFO09fLbQEi4HtSwxZCVATdNOqKSq_oQahA8raDZxVAQkZER8qNbDQc0wWs16YmE2kDL3tNgUW1ko33e3IjTr97cKZ2_iGUw3eZpojANvrEF191v0agYTPlXilB7r6c7yPh_da0KSh4HtMRUFeK6bpc09fu" alt="User profile" className="w-8 h-8 rounded-full border border-outline-variant/20" />
        </div>
      </div>
    </header>
  );
}