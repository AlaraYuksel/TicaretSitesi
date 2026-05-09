import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import EditorHeader from '../components/editor/EditorHeader';
import EditorToolRibbon from '../components/editor/EditorToolRibbon';
import EditorElementPanel from '../components/editor/EditorElementPanel';
import EditorInspector from '../components/editor/EditorInspector';
import EditorCanvas from '../components/editor/EditorCanvas';
import EditorStatusBar from '../components/editor/EditorStatusBar';
import EditorLayersPanel from '../components/editor/EditorLayerPanel';
import EditorPagesPanel from '../components/editor/EditorPagesPanel';
import { useEditorStore } from '../store/useEditorStore';
import { apiGetSite } from '../lib/api';

export default function Editor() {
  const { siteId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [siteTitle, setSiteTitle] = useState('');

  useEffect(() => {
    if (!siteId) {
      navigate('/dashboard');
      return;
    }
    loadSite();
  }, [siteId]);

  async function loadSite() {
    try {
      setLoading(true);
      setError(null);
      const site = await apiGetSite(siteId);
      setSiteTitle(site.title);

      // site_data'yı store'a yükle
      const siteData = site.site_data || { pages: [] };
      const pages = siteData.pages || [];

      const store = useEditorStore.getState();

      if (pages.length > 0) {
        // Mevcut sayfaları store'a ata
        useEditorStore.setState({
          pages: pages,
          activePageId: pages[0].id,
          selectedId: null,
          selectedChildId: null,
          activeContainerId: null,
          history: [],
          historyIndex: -1,
        });
      } else {
        // Boş site — default page ile başla
        useEditorStore.setState({
          pages: [{ id: `page_${Date.now()}`, name: 'Home', elements: [] }],
          activePageId: null,
          selectedId: null,
          selectedChildId: null,
          activeContainerId: null,
          history: [],
          historyIndex: -1,
        });
        // activePageId'yi set et
        const state = useEditorStore.getState();
        useEditorStore.setState({ activePageId: state.pages[0].id });
      }

      // canvasHeights varsa ata
      if (siteData.canvasHeights || site.canvas_heights) {
        const ch = siteData.canvasHeights || site.canvas_heights;
        useEditorStore.setState({ canvasHeights: ch });
      }

    } catch (err) {
      if (err.message === 'UNAUTHORIZED') {
        navigate('/');
        return;
      }
      setError(err.message);
      console.error('Site yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#131313', color: '#555',
        fontFamily: 'Inter, sans-serif', fontSize: 14, flexDirection: 'column', gap: 12
      }}>
        <svg className="animate-spin" style={{ width: 24, height: 24 }} viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <span>Site yükleniyor...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#131313', color: '#e5e2e1',
        fontFamily: 'Inter, sans-serif', fontSize: 14, flexDirection: 'column', gap: 16
      }}>
        <span style={{ fontSize: 48, opacity: 0.3 }}>⚠️</span>
        <h2 style={{ fontWeight: 700, fontSize: 20 }}>Site yüklenemedi</h2>
        <p style={{ color: '#666' }}>{error}</p>
        <button 
          onClick={() => navigate('/dashboard')}
          style={{ marginTop: 8, padding: '10px 24px', background: '#4b8eff', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}
        >
          Dashboard'a Dön
        </button>
      </div>
    );
  }

  return (
    <div className="antialiased selection:bg-primary-container selection:text-on-primary-container overflow-hidden h-screen bg-[#131313]">
      <EditorHeader siteId={siteId} siteTitle={siteTitle} />
      
      {/* Sol Menüler */}
      <EditorToolRibbon />
      <EditorLayersPanel />
      <EditorPagesPanel />
      <EditorElementPanel />
      
      {/* Sağ Panel */}
      <EditorInspector />
      
      {/* Orta Çalışma Alanı */}
      <EditorCanvas />
      
      <EditorStatusBar />
    </div>
  );
}