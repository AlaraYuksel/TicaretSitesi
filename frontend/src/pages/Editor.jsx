import React from 'react';
import EditorHeader from '../components/editor/EditorHeader';
import EditorToolRibbon from '../components/editor/EditorToolRibbon';
import EditorElementPanel from '../components/editor/EditorElementPanel';
import EditorInspector from '../components/editor/EditorInspector';
import EditorCanvas from '../components/editor/EditorCanvas';
import EditorStatusBar from '../components/editor/EditorStatusBar';
import EditorLayersPanel from '../components/editor/EditorLayerPanel';
import EditorPagesPanel from '../components/editor/EditorPagesPanel';

export default function Editor() {
  return (
    <div className="antialiased selection:bg-primary-container selection:text-on-primary-container overflow-hidden h-screen bg-[#131313]">
      <EditorHeader />
      
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