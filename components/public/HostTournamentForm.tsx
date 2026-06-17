'use client';

import { useState } from 'react';
import { CheckCircle2, Send, Loader2 } from 'lucide-react';

const SPORTS_OPTIONS = ['Badminton', 'Table Tennis', 'Volleyball', 'Throw Ball', 'Chess', 'Pickleball', 'Multiple Sports', 'Other'];
const SIZE_OPTIONS = ['< 20 participants', '20–50', '50–100', '100–200', '200+'];

export function HostTournamentForm() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    organisation: '',
    sport: '',
    size: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const body = [
      `Name: ${form.name}`,
      `Email: ${form.email}`,
      `Phone: ${form.phone}`,
      `Organisation: ${form.organisation}`,
      `Sport: ${form.sport}`,
      `Expected Participants: ${form.size}`,
      `Message: ${form.message}`,
    ].join('%0D%0A');

    const subject = encodeURIComponent(`Tournament Hosting Inquiry — ${form.name}`);
    window.open(`mailto:sports@pbelcity.com?subject=${subject}&body=${body}`, '_blank');

    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 600);
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-green-400/10 border border-green-400/30 flex items-center justify-center mb-5">
          <CheckCircle2 className="h-8 w-8 text-green-400" />
        </div>
        <h3 className="text-xl font-black text-white mb-2">We&apos;re on it!</h3>
        <p className="text-slate-400 text-sm max-w-sm">
          Your email client should have opened. If not, drop us a line at{' '}
          <span className="text-yellow-400 font-semibold">sports@pbelcity.com</span> and we&apos;ll get back to you within 24 hours.
        </p>
        <button
          onClick={() => { setSubmitted(false); setForm({ name: '', email: '', phone: '', organisation: '', sport: '', size: '', message: '' }); }}
          className="mt-6 text-xs text-slate-500 hover:text-white underline underline-offset-4 transition-colors"
        >
          Submit another inquiry
        </button>
      </div>
    );
  }

  const inputCls = "w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-400 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/30 transition-all outline-none";
  const selectCls = "w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-sm text-white focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/30 transition-all outline-none appearance-none cursor-pointer";
  const labelCls = "block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Your Name *</label>
          <input
            required
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Rajesh Kumar"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Email *</label>
          <input
            required
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            placeholder="you@example.com"
            className={inputCls}
          />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Phone Number</label>
          <input
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
            placeholder="+91 98765 43210"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Club / Organisation</label>
          <input
            value={form.organisation}
            onChange={e => set('organisation', e.target.value)}
            placeholder="PBEL Sports Club"
            className={inputCls}
          />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Sport *</label>
          <select
            required
            value={form.sport}
            onChange={e => set('sport', e.target.value)}
            className={selectCls}
          >
            <option value="" disabled>Select sport…</option>
            {SPORTS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Expected Participants</label>
          <select
            value={form.size}
            onChange={e => set('size', e.target.value)}
            className={selectCls}
          >
            <option value="" disabled>Select size…</option>
            {SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>Tell Us More</label>
        <textarea
          rows={3}
          value={form.message}
          onChange={e => set('message', e.target.value)}
          placeholder="Dates you have in mind, format, anything specific you need…"
          className={`${inputCls} resize-none`}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-60 text-black font-black px-8 py-4 rounded-xl text-sm shadow-lg shadow-yellow-400/25 transition-all duration-200 hover:scale-[1.02] active:scale-[0.99]"
      >
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
        ) : (
          <><Send className="h-4 w-4" /> Send Hosting Inquiry</>
        )}
      </button>
    </form>
  );
}
