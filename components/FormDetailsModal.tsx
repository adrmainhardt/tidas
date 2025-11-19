
import React, { useEffect } from 'react';
import { FormSubmission } from '../types';
import { X, Calendar, Mail, Globe, User } from 'lucide-react';

interface FormDetailsModalProps {
  form: FormSubmission;
  siteName: string;
  onClose: () => void;
}

const FormDetailsModal: React.FC<FormDetailsModalProps> = ({ form, siteName, onClose }) => {
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
      <div className="relative bg-slate-800 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-start p-5 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-full">
              <Mail className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-100 leading-tight">{form.senderName}</h3>
              <div className="flex items-center gap-1.5 mt-1">
                <Globe className="w-3 h-3 text-slate-500" />
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{siteName}</span>
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

        {/* Corpo com Scroll */}
        <div className="p-5 overflow-y-auto text-slate-300 space-y-4">
          {/* Metadados */}
          <div className="flex flex-wrap gap-3 text-xs mb-4">
            <div className="flex items-center gap-1.5 bg-slate-700/50 px-2.5 py-1.5 rounded-md border border-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {form.timestamp.toLocaleDateString()} às {form.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <a 
              href={`mailto:${form.senderEmail}`}
              className="flex items-center gap-1.5 bg-slate-700/50 px-2.5 py-1.5 rounded-md border border-slate-700 hover:bg-slate-700 hover:text-blue-300 transition-colors"
            >
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>{form.senderEmail}</span>
            </a>
          </div>

          {/* Mensagem Completa */}
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
             <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
               {form.message}
             </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex justify-end">
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

export default FormDetailsModal;
