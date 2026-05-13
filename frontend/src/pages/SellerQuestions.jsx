import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import { apiSellerListQuestions, apiSellerAnswerQuestion } from '../lib/api';

const formatDate = (iso) => iso ? new Date(iso).toLocaleString('tr-TR') : '';

export default function SellerQuestions() {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      setList(await apiSellerListQuestions(filter));
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, [filter]);

  return (
    <DashboardLayout activeKey="questions">
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 24px' }}>Müşteri Soruları</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <Chip active={filter === 'pending'} onClick={() => setFilter('pending')}>Bekleyen</Chip>
        <Chip active={filter === 'answered'} onClick={() => setFilter('answered')}>Cevaplanan</Chip>
        <Chip active={filter === ''} onClick={() => setFilter('')}>Hepsi</Chip>
      </div>

      {loading && <div style={{ color: '#999' }}>Yükleniyor...</div>}
      {!loading && list.length === 0 && (
        <div style={{ color: '#999' }}>Bu filtreye uyan soru yok.</div>
      )}

      {list.map(q => (
        <QuestionCard key={q.id} q={q} onAnswered={reload} />
      ))}
    </DashboardLayout>
  );
}

function QuestionCard({ q, onAnswered }) {
  const [editing, setEditing] = useState(false);
  const [answer, setAnswer] = useState(q.answer || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async () => {
    setSaving(true); setErr(null);
    try {
      await apiSellerAnswerQuestion(q.id, answer.trim());
      setEditing(false);
      onAnswered();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          {q.product_title && <div style={{ fontSize: 12, color: '#999' }}>{q.product_title}</div>}
          <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
            {q.buyer_name || 'Kullanıcı'} · {formatDate(q.created_at)}
          </div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '4px 10px',
          background: q.is_answered ? '#1f7a3c' : '#a16207', color: '#fff',
          letterSpacing: '0.05em', textTransform: 'uppercase',
        }}>{q.is_answered ? 'Cevaplandı' : 'Bekliyor'}</span>
      </div>

      <div style={{ marginBottom: 12, padding: 12, background: '#0f0f0f', borderRadius: 4 }}>
        <strong style={{ display: 'block', marginBottom: 4, color: '#c1c6d7', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Soru</strong>
        <div style={{ color: '#e5e2e1' }}>{q.question}</div>
      </div>

      {q.is_answered && !editing && (
        <div style={{ padding: 12, background: '#0f1f0f', borderRadius: 4 }}>
          <strong style={{ display: 'block', marginBottom: 4, color: '#86efac', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cevabınız</strong>
          <div style={{ color: '#e5e2e1' }}>{q.answer}</div>
          <button onClick={() => { setEditing(true); setAnswer(q.answer || ''); }} style={linkBtn}>Düzenle</button>
        </div>
      )}

      {(!q.is_answered || editing) && (
        <div>
          <textarea
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            placeholder="Cevabınız..."
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#0f0f0f', color: '#e5e2e1',
              border: '1px solid #2a2a2a', padding: 12, fontSize: 14,
              fontFamily: 'inherit', resize: 'vertical',
            }}
          />
          {err && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={submit} disabled={saving || answer.trim().length < 2} style={primaryBtn}>
              {saving ? 'KAYDEDİLİYOR...' : 'CEVABI GÖNDER'}
            </button>
            {editing && <button onClick={() => setEditing(false)} style={ghostBtn}>VAZGEÇ</button>}
          </div>
        </div>
      )}
    </div>
  );
}

const cardStyle = { background: '#1c1b1b', border: '1px solid #2a2a2a', padding: 20, marginBottom: 12, borderRadius: 6 };
const primaryBtn = { background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 18px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer' };
const ghostBtn = { background: 'transparent', color: '#c1c6d7', border: '1px solid #2a2a2a', padding: '10px 18px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer' };
const linkBtn = { background: 'none', border: 'none', color: '#86efac', fontSize: 12, cursor: 'pointer', marginTop: 8, padding: 0 };

function Chip({ active, onClick, children }) {
  return <button onClick={onClick} style={{
    background: active ? '#2a2a2a' : 'transparent', color: '#e5e2e1',
    border: '1px solid #2a2a2a', padding: '8px 16px', fontSize: 12,
    cursor: 'pointer', borderRadius: 999, fontWeight: active ? 700 : 500,
  }}>{children}</button>;
}
