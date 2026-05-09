import React from 'react';
import TopNavBar from '../components/dashboard/TopNavBar';
import SideNavBar from '../components/dashboard/SideNavBar';
import ProjectCard from '../components/dashboard/ProjectCard';
import { useNavigate } from 'react-router-dom'; // Bunu ekledik

export default function Dashboard() {
  // Örnek Proje Verileri (İleride API'den gelecek)
  const navigate = useNavigate();
  const projects = [
    { id: 1, title: 'Luminal Portfolio', lastEdited: 'Edited 2 hours ago', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBNCr0IcJQkyG3v0ht8RgtXMZrWZzUU1DVLdDJYJBOAHHMMgq7E4Ty9R8c9gW7FCsCmgZ0T2YfUKfgTEApx11zNwmTVRMI2PY1W17sbGe35ca9GbxRtRUZw77Z2QhTIDMsv6rWJiiV3mWH-gpAUm-88BENIcWGfYVKJCDrdqfkuKFU7Sbn895dU_ASaoUJIwBXHyGWLPbA5BYnwrdNb01SkDhPdvWuZBZnmCf0b2YZ6_h_YiTyPfXM_WDVVsqdtc9TMUDkbUIcw', isActive: true },
    { id: 2, title: 'Monolith Studio', lastEdited: 'Edited 1 day ago', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCaRISHn1qNnVwpVzDxHpcx02QMB3QB0y7pX8h3gSHA3wvidKIz1cg66L47DvJibZYkPXCuNHMOBkrSPAI06KaNYyZHUaAAPq79SvLMnYvDxnMrkIT5157EUrR3vW81IzuL2z1TAecxQMZqs5TiFSWDGQMWpjRPKjv0M2SB2soKaTeRuMHKcyQtVclgyXAyYHvk1GIjQasPN_BjoMl4qr4eXF1prMV74CLhboSBL5onuQO0wUN1COIMvdaWlZYQ6xZvT-pQtV6O', isActive: false },
    { id: 3, title: 'Vector SaaS', lastEdited: 'Edited 3 days ago', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBHxPTr5F2c_A7__uMbDiGOyLRCC9foJUx6bfJSdpm7EiMJmZWlylpnPq3DcpOObo-_PE3rriszftTDjtMcCjK3U2gSMsOOVBL-dYoi-c1geTOvAI1biL9ISeBbf9s-lLOJlkoOrxkFGcxa8SHc-gAkYgVTbjhdLxrrrOz78ikG6dgMeTO-wktW8-BjYKtcstDX62u2Uc2_Fia9BjXg2QqrBwQzUL958jaky03ZStFcqKeYM8_k1GqTsu8lHxm4VpZsld1MlagX', isActive: false },
    { id: 4, title: 'Devflow App', lastEdited: 'Edited Oct 24, 2023', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBZv8ioLt5SMrsRR8wR26ll4WrMtNGgOlXY7TgMliACd-NDUSsqBst_Rl8tgbSXgVkVggWecdeuflFHh4xqxrbt6YkxEroRf059xVNWGfHUmMVt12ORAhRWmXHPeTXOCP4cXhf_pZHp3R5-97B0OhsJiFaELIDxlO1C_nbM64lKOh1wFprCLzTu6KbqJBGFWuD93-sQmP7aCooie8IRIBjz_HfD47RVGaAAHOLSqW27T2vAAdWKDn4YvGhPga1i6FXtXkYpmZfs', isActive: false },
  ];

  return (
    <div className="bg-background text-on-surface font-body antialiased h-screen overflow-y-auto">
      <TopNavBar />
      <SideNavBar />
      
      {/* Ana İçerik Alanı */}
      <main className="pl-64 pt-16 min-h-screen bg-surface-container-lowest">
        <div className="max-w-7xl mx-auto px-10 py-12">
          
          {/* Header */}
          <div className="flex justify-between items-end mb-10">
            <div>
                <h1 className="text-4xl font-extrabold tracking-tight text-on-surface mb-2">My Sites</h1>
                <p className="text-on-surface-variant text-sm">Manage and evolve your kinetic digital experiences.</p>
            </div>
      
            {/* onClick ekledik */}
            <button 
                 onClick={() => navigate('/editor')}
             className="group flex items-center gap-3 px-6 py-4 bg-primary-container text-on-primary-container rounded-xl font-bold shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all active:scale-95"
            >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>add_circle</span>
            Create New Site
        </button>
            </div>

          {/* Grid Alanı */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            
            {/* Projeler */}
            {projects.map(project => (
            <div key={project.id} onClick={() => navigate('/editor')} className="cursor-pointer">
            <ProjectCard 
                title={project.title}
                lastEdited={project.lastEdited}
                imageUrl={project.imageUrl}
                isActive={project.isActive}
              />
            </div>
      ))}

            {/* Yeni Proje Ekle (Empty State / Placeholder) */}
            <div className="border-2 border-dashed border-outline-variant/30 rounded-xl flex flex-col items-center justify-center p-8 bg-transparent hover:bg-surface-container-low/50 hover:border-primary/50 transition-all group cursor-pointer aspect-video md:aspect-auto h-full">
              <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center mb-4 group-hover:bg-primary-container transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant group-hover:text-on-primary-container">add</span>
              </div>
              <span className="text-on-surface font-medium">New Project</span>
              <span className="technical-label mt-1">Select a blank canvas</span>
            </div>
          </div>

          {/* Alt İstatistikler (Footer Stats) */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="col-span-2 bg-[#1c1b1b] p-8 rounded-2xl flex items-center justify-between border border-outline-variant/5">
              <div>
                <h4 className="text-on-surface font-bold text-xl mb-1">Storage Usage</h4>
                <p className="technical-label mb-4">4.2 GB of 10 GB used</p>
                <div className="w-64 h-2 bg-surface-container-highest rounded-full overflow-hidden">
                  <div className="w-5/12 h-full bg-primary-container"></div>
                </div>
              </div>
              <button className="text-primary font-semibold hover:underline decoration-2 underline-offset-4">Upgrade Plan</button>
            </div>
            
            <div className="bg-primary-container/5 p-8 rounded-2xl border border-primary/10">
              <span className="material-symbols-outlined text-primary-container mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              <h4 className="text-on-surface font-bold text-xl mb-1">AI Insights</h4>
              <p className="technical-label">Optimization tips available for 2 sites.</p>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}