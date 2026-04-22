'use client';

import { useEffect, useState } from 'react';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'loading';
  message: string;
  duration?: number;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const add = (message: string, type: 'success' | 'error' | 'info' | 'loading' = 'info', duration = 4000) => {
    const id = Date.now().toString();
    const newToast: ToastMessage = { id, type, message, duration };
    setToasts(prev => [...prev, newToast]);
    
    if (duration && duration > 0) {
      setTimeout(() => remove(id), duration);
    }
    
    return id;
  };

  const remove = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return { toasts, add, remove };
}

interface ToastProps {
  message: ToastMessage;
  onRemove: (id: string) => void;
}

function Toast({ message, onRemove }: ToastProps) {
  const bgColor = {
    success: 'bg-emerald-500/90',
    error: 'bg-red-500/90',
    info: 'bg-blue-500/90',
    loading: 'bg-amber-500/90',
  }[message.type];

  const icon = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    loading: '⟳',
  }[message.type];

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-white text-sm font-medium ${bgColor} shadow-lg animate-slide-in ${
        message.type === 'loading' ? 'animate-pulse' : ''
      }`}
    >
      <span className={message.type === 'loading' ? 'animate-spin' : ''}>{icon}</span>
      <span className="flex-1">{message.message}</span>
      {message.type !== 'loading' && (
        <button
          onClick={() => onRemove(message.id)}
          className="text-white/70 hover:text-white transition-colors"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export function ToastContainer({ toasts, onRemove }: { toasts: ToastMessage[]; onRemove: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md pointer-events-auto">
      {toasts.map(toast => (
        <Toast key={toast.id} message={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}
