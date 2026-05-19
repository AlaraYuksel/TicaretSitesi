import React, { useEffect, useState } from 'react';
import TopNavBar from '../components/dashboard/TopNavBar';
import SideNavBar from '../components/dashboard/SideNavBar';
import ProjectCard from '../components/dashboard/ProjectCard';
import { useNavigate } from 'react-router-dom';
import { apiListSites, apiCreateSite, apiDeleteSite } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showNewSiteModal, setShowNewSiteModal] = useState(false);
  const [newSiteTitle, setNewSiteTitle] = useState('');
  const [newSiteSubdomain, setNewSiteSubdomain] = useState('');

  // Siteleri yükle
  useEffect(() => {
    loadSites();
  }, []);

  async function loadSites() {
    try {
      setLoading(true);
      const data = await apiListSites();
      setSites(data || []);
    } catch (err) {
      if (err.message === 'UNAUTHORIZED') {
        navigate('/');
        return;
      }
      console.error('Sites yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSite() {
    if (!newSiteTitle.trim()) return;
    try {
      setCreating(true);
      const site = await apiCreateSite(newSiteTitle.trim(), newSiteSubdomain.trim() || undefined);
      setShowNewSiteModal(false);
      setNewSiteTitle('');
      setNewSiteSubdomain('');
      navigate(`/editor/${site.id}`);
    } catch (err) {
      console.error('Site oluşturulamadı:', err);
      alert('Site oluşturulamadı: ' + err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteSite(e, siteId) {
    e.stopPropagation();
    if (!confirm('Bu siteyi silmek istediğinizden emin misiniz?')) return;
    try {
      await apiDeleteSite(siteId);
      setSites(s => s.filter(site => site.id !== siteId));
    } catch (err) {
      console.error('Site silinemedi:', err);
    }
  }

  function handleLogout() {
    logout();
    navigate('/');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffH = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffH < 1) return 'Az önce düzenlendi';
    if (diffH < 24) return `${diffH} saat önce düzenlendi`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD} gün önce düzenlendi`;
    return `${d.toLocaleDateString('tr-TR')} tarihinde düzenlendi`;
  }

  return (
    <div className="bg-background text-on-surface font-body antialiased h-screen overflow-y-auto">
      <TopNavBar onLogout={handleLogout} userEmail={user?.email} />
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
      
            <button 
              onClick={() => setShowNewSiteModal(true)}
              className="group flex items-center gap-3 px-6 py-4 bg-primary-container text-on-primary-container rounded-xl font-bold shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>add_circle</span>
              Create New Site
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center gap-3 text-on-surface-variant">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <span className="text-sm">Siteler yükleniyor...</span>
              </div>
            </div>
          )}

          {/* Grid Alanı */}
          {!loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              
              {/* Projeler */}
              {sites.map(site => (
                <div key={site.id} className="relative group">
                  <div onClick={() => navigate(`/editor/${site.id}`)} className="cursor-pointer">
                    <ProjectCard 
                      title={site.title}
                      lastEdited={formatDate(site.updated_at)}
                      imageUrl={site.thumbnail_url || ''}
                      isActive={site.is_published}
                    />
                  </div>
                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDeleteSite(e, site.id)}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/80 hover:bg-red-500 text-white rounded-lg p-1.5 z-10"
                    title="Siteyi sil"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                  </button>
                </div>
              ))}

              {/* Yeni Proje Ekle (Empty State / Placeholder) */}
              <div 
                onClick={() => setShowNewSiteModal(true)}
                className="border-2 border-dashed border-outline-variant/30 rounded-xl flex flex-col items-center justify-center p-8 bg-transparent hover:bg-surface-container-low/50 hover:border-primary/50 transition-all group cursor-pointer aspect-video md:aspect-auto h-full min-h-[200px]"
              >
                <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center mb-4 group-hover:bg-primary-container transition-colors">
                  <span className="material-symbols-outlined text-on-surface-variant group-hover:text-on-primary-container">add</span>
                </div>
                <span className="text-on-surface font-medium">New Project</span>
                <span className="technical-label mt-1">Select a blank canvas</span>
              </div>
            </div>
          )}

          {/* Boş durum */}
          {!loading && sites.length === 0 && (
            <div className="text-center py-16">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-4 block" style={{ fontVariationSettings: "'FILL' 1" }}>web</span>
              <h3 className="text-xl font-bold text-on-surface mb-2">Henüz siteniz yok</h3>
              <p className="text-on-surface-variant text-sm mb-6">İlk sitenizi oluşturarak başlayın!</p>
            </div>
          )}

          {/* Alt İstatistikler (Footer Stats) */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="col-span-2 bg-[#1c1b1b] p-8 rounded-2xl flex items-center justify-between border border-outline-variant/5">
              <div>
                <h4 className="text-on-surface font-bold text-xl mb-1">Storage Usage</h4>
                <p className="technical-label mb-4">{user?.storage_used ? (user.storage_used / 1e9).toFixed(1) : '0'} GB of {user?.storage_limit ? (user.storage_limit / 1e9).toFixed(0) : '10'} GB used</p>
                <div className="w-64 h-2 bg-surface-container-highest rounded-full overflow-hidden">
                  <div className="h-full bg-primary-container" style={{ width: `${user?.storage_limit ? (user.storage_used / user.storage_limit * 100) : 0}%` }}></div>
                </div>
              </div>
              <button className="text-primary font-semibold hover:underline decoration-2 underline-offset-4">Upgrade Plan</button>
            </div>
            
            <div className="bg-primary-container/5 p-8 rounded-2xl border border-primary/10">
              <span className="material-symbols-outlined text-primary-container mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              <h4 className="text-on-surface font-bold text-xl mb-1">AI Insights</h4>
              <p className="technical-label">Optimization tips available for {sites.filter(s => s.is_published).length} sites.</p>
            </div>
          </div>

        </div>
      </main>

      {/* Yeni Site Modal */}
      {showNewSiteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center" onClick={() => setShowNewSiteModal(false)}>
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-on-surface mb-2">Yeni Site Oluştur</h2>
            <p className="text-on-surface-variant text-sm mb-6">Sitenize bir isim verin ve başlayın.</p>
            
            <input
              type="text"
              placeholder="Site adı (ör: Portfolyom)"
              value={newSiteTitle}
              onChange={e => setNewSiteTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateSite()}
              autoFocus
              className="w-full px-4 py-3 bg-[#141414] border border-white/10 rounded-xl text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all mb-4"
            />

            {/* Subdomain — yayın adresi */}
            <label className="block text-on-surface-variant text-xs mb-1.5">Yayın adresi (subdomain)</label>
            <div className="flex items-center bg-[#141414] border border-white/10 rounded-xl overflow-hidden focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
              <input
                type="text"
                placeholder="ornek"
                value={newSiteSubdomain}
                onChange={e => setNewSiteSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                onKeyDown={e => e.key === 'Enter' && handleCreateSite()}
                maxLength={63}
                className="flex-1 px-4 py-3 bg-transparent text-on-surface placeholder:text-on-surface-variant/50 outline-none"
              />
              <span className="px-3 text-on-surface-variant/60 text-sm select-none whitespace-nowrap">.iluvcode.art</span>
            </div>
            <p className="text-on-surface-variant/50 text-xs mt-1.5 mb-6">
              {newSiteSubdomain
                ? `Siteniz yayınlanınca: https://${newSiteSubdomain}.iluvcode.art`
                : 'Boş bırakılırsa site bir URL ile yayınlanamaz.'}
            </p>

            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setShowNewSiteModal(false)}
                className="px-5 py-2.5 rounded-xl text-on-surface-variant font-medium hover:bg-white/5 transition-colors"
              >
                İptal
              </button>
              <button 
                onClick={handleCreateSite}
                disabled={creating || !newSiteTitle.trim()}
                className="px-5 py-2.5 rounded-xl bg-primary-container text-on-primary-container font-bold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Oluşturuluyor...' : 'Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}