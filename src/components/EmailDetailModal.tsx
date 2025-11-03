import { useState, useEffect } from 'react';
import type { Email } from '../types';
import { X, Eye, EyeOff } from 'lucide-react';

interface Props {
  email: Email | null;
  onClose: () => void;
}

export function EmailDetailModal({ email, onClose }: Props) {
  const [showHtml, setShowHtml] = useState(true);

  // Block body scroll and scroll to top when modal opens
  useEffect(() => {
    if (email) {
      // Save current scroll position
      const scrollY = window.scrollY;
      
      // Scroll to top
      window.scrollTo(0, 0);
      
      // Block body scroll
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      
      return () => {
        // Restore body scroll
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        
        // Restore scroll position
        window.scrollTo(0, scrollY);
      };
    }
  }, [email]);

  if (!email) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-8 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col" style={{ maxHeight: 'calc(100vh - 4rem)' }}>
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{email.subject}</h2>
            <p className="text-sm text-gray-600">From {email.from_email} · {new Date(email.date).toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowHtml((prev: boolean) => !prev)}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              {showHtml ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showHtml ? 'Show plain text' : 'Show HTML'}
            </button>
            <button
              onClick={onClose}
              className="text-gray-600 hover:text-gray-900"
              aria-label="Close email detail"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        <section className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-500 uppercase tracking-wide mb-1">AI Summary</p>
          <p className="text-gray-800 leading-relaxed">{email.ai_summary}</p>
        </section>

        <main className="flex-1 overflow-y-auto px-6 py-6">
          {showHtml && email.content_html ? (
            <article
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: email.content_html }}
            />
          ) : (
            <pre className="whitespace-pre-wrap text-sm text-gray-800 bg-gray-100 rounded-lg p-4">
              {email.content_text || 'No plain text content available.'}
            </pre>
          )}
        </main>
      </div>
    </div>
  );
}
