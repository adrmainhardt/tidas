
import React, { useState, useEffect } from 'react';
import { X, Slack, ExternalLink, Save, Send } from 'lucide-react';
import { sendSlackNotification } from '../services/slackService';

interface SlackConfigModalProps {
  currentUrl: string;
  onSave: (url: string) => void;
  onClose: () => void;
}

const SlackConfigModal: React.FC<SlackConfigModalProps> = ({ currentUrl, onSave, onClose }) => {
  const [url, setUrl] = useState(currentUrl);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleSave = () => {
    onSave(url);
    onClose();
  };

  const handleTest = async () => {
    if (!url) return;
    setIsTesting(true);
    await sendSlackNotification(url, "🔔 *Teste Tidas*: Integração funcionando corretamente!");
    setTimeout(() => setIsTesting(false), 1000);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in">
      <div 
        className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      <div className="relative bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
        <div className="p-5 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Slack className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-lg text-slate-100">Integração Slack</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-400">
            Receba notificações de novas mensagens e status de site diretamente em um canal.
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Webhook URL</label>
            <input 
              type="text" 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
            
          <div className="flex justify-between items-center">
              <a 
                href="https://api.slack.com/messaging/webhooks" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
              >
                <ExternalLink className="w-3 h-3" /> Ajuda
              </a>
              
              <button 
                onClick={handleTest}
                disabled={!url || isTesting}
                className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded flex items-center gap-1 transition-colors disabled:opacity-50"
              >
                 <Send className="w-3 h-3" /> {isTesting ? 'Enviando...' : 'Testar Envio'}
              </button>
          </div>
        </div>

        <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex justify-end">
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" /> Salvar Configuração
          </button>
        </div>
      </div>
    </div>
  );
};

export default SlackConfigModal;
