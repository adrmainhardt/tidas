
import { EmailMessage } from "../types";

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessagePart {
  headers: GmailHeader[];
  body?: { data?: string };
  parts?: GmailMessagePart[];
}

interface GmailMessageDetail {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet: string;
  internalDate: string;
  payload: GmailMessagePart;
}

interface GmailListResponse {
  messages?: { id: string; threadId: string }[];
  nextPageToken?: string;
  resultSizeEstimate: number;
}

/**
 * Busca os e-mails mais recentes da caixa de entrada.
 */
export const fetchGmailMessages = async (accessToken: string, maxResults: number = 60): Promise<EmailMessage[]> => {
  try {
    // MUDANÇA CRÍTICA: Usar 'is:unread' em vez de 'label:INBOX'.
    // Garantimos timestamp único no URL para evitar cache do navegador sem precisar de headers complexos
    const listUrl = `${GMAIL_API_BASE}/messages?maxResults=${maxResults}&q=is:unread&includeSpamTrash=false&_=${Date.now()}`;
    
    // IMPORTANTE: Para evitar erros de CORS (Preflight), enviamos APENAS o Authorization em requisições GET.
    // Headers como Content-Type (em GET), Cache-Control customizados, etc, disparam um preflight que a API do Google rejeita.
    const listResponse = await fetch(listUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
    });

    if (!listResponse.ok) {
      if (listResponse.status === 401) {
        throw new Error("AUTH_EXPIRED");
      }
      const errText = await listResponse.text();
      console.error("Gmail API Error Body:", errText);
      throw new Error(`Erro na API Gmail: ${listResponse.status} ${listResponse.statusText}`);
    }

    const listData: GmailListResponse = await listResponse.json();

    if (!listData.messages || listData.messages.length === 0) {
      return [];
    }

    // Busca detalhes em paralelo
    const detailsPromises = listData.messages.map(msg => 
      fetch(`${GMAIL_API_BASE}/messages/${msg.id}?format=full&_=${Date.now()}`, {
        method: 'GET',
        headers: { 
          Authorization: `Bearer ${accessToken}`
        }
      }).then(res => res.json() as Promise<GmailMessageDetail>)
    );

    const detailsData = await Promise.all(detailsPromises);

    // Filtra mensagens válidas e ordena explicitamente por data (mais recente primeiro)
    return detailsData
      .filter(msg => msg && msg.id) 
      .map(msg => parseGmailMessage(msg))
      .sort((a, b) => b.date.getTime() - a.date.getTime());

  } catch (error: any) {
    console.error("Erro no fetch do Gmail:", error);
    throw error;
  }
};

/**
 * Helper para extrair dados relevantes do JSON complexo do Gmail.
 */
const parseGmailMessage = (msg: GmailMessageDetail): EmailMessage => {
  const headers = msg.payload?.headers || [];
  const labelIds = msg.labelIds || [];
  
  const getHeader = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
  
  const subject = getHeader('Subject') || '(Sem Assunto)';
  const from = getHeader('From');
  
  // Limpa o remetente para pegar apenas o nome se possível
  const cleanSender = from ? from.split('<')[0].trim().replace(/"/g, '') : 'Desconhecido';

  const isUnread = labelIds.includes('UNREAD');
  
  // Determina label visual baseado nas categorias do Gmail
  let label: 'Primary' | 'Updates' | 'Promotions' = 'Primary';
  if (labelIds.includes('CATEGORY_UPDATES')) label = 'Updates';
  if (labelIds.includes('CATEGORY_PROMOTIONS')) label = 'Promotions';

  return {
    id: msg.id,
    sender: cleanSender || from,
    subject: subject,
    snippet: msg.snippet || '', 
    date: new Date(parseInt(msg.internalDate)),
    isUnread,
    label
  };
};
