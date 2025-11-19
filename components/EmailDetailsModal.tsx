
import React, { useEffect } from 'react';
import { EmailMessage } from '../types';
import { X, Calendar, User, Mail } from 'lucide-react';

interface EmailDetailsModalProps {
  email: EmailMessage;
  onClose: () => void;
}

const EmailDetailsModal: React.FC<EmailDetailsModalProps> = ({ email, onClose }) => {
  // Fecha ao pressionar ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop com blur */}
      <div 
        className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* Card do Modal */}
      <div className="relative bg-slate-800 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col h-[85vh]">
        
        {/* Header */}
        <div className="flex justify-between items-start p-5 border-b border-slate-700 bg-slate-800/50 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 bg-blue-500/20 rounded-full shrink-0">
              <Mail className="w-5 h-5 text-blue-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-lg text-slate-100 leading-tight truncate">{email.sender}</h3>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-xs font-medium text-slate-400 truncate max-w-[250px]">{email.subject}</span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 -mr-2 -mt-2 text-slate-400 hover:text-slate-100 hover:bg-slate-700 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Info Bar */}
        <div className="px-5 py-3 bg-slate-900/30 border-b border-slate-700/50 flex flex-wrap gap-3 text-xs shrink-0">
            <div className="flex items-center gap-1.5 bg-slate-700/50 px-2.5 py-1.5 rounded-md border border-slate-700 text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {email.date.toLocaleDateString()} às {email.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            {/* Extraímos o e-mail do sender se possível para o mailto */}
            <a 
              href={`mailto:${email.sender.includes('<') ? email.sender.match(/<([^>]+)>/)?.[1] : email.sender}`}
              className="flex items-center gap-1.5 bg-slate-700/50 px-2.5 py-1.5 rounded-md border border-slate-700 hover:bg-slate-700 hover:text-blue-300 transition-colors text-slate-300"
            >
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Responder</span>
            </a>
        </div>

        {/* Corpo do Email (iframe para isolamento de CSS) */}
        <div className="flex-1 bg-white w-full relative">
           <iframe 
             title="Email Content"
             srcDoc={`
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: system-ui, -apple-system, sans-serif; font-size: 14px; line-height: 1.5; color: #333; padding: 16px; margin: 0; }
                        a { color: #2563eb; }
                        img { max-width: 100%; height: auto; }
                    </style>
                </head>
                <body>
                    ${email.body}
                </body>
                </html>
             `}
             className="w-full h-full absolute inset-0 border-0"
             sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
           />
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex justify-end shrink-0">
          <button 
            onClick={onClose}
            className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailDetailsModal;
