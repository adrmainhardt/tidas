
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
  labelIds?: string[]; // Opcional na API
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
export const fetchGmailMessages = async (accessToken: string, maxResults: number = 80): Promise<EmailMessage[]> => {
  try {
    // Busca lista de IDs. label:INBOX é mais preciso para API que in:inbox
    // Adiciona timestamp para bypass total de cache
    const listUrl = `${GMAIL_API_BASE}/messages?maxResults=${maxResults}&q=label:INBOX&includeSpamTrash=false&_=${Date.now()}`;
    
    const listResponse = await fetch(listUrl, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
    });

    if (!listResponse.ok) {
      if (listResponse.status === 401) {
        throw new Error("AUTH_EXPIRED");
      }
      throw new Error(`Erro na API Gmail: ${listResponse.statusText}`);
    }

    const listData: GmailListResponse = await listResponse.json();

    if (!listData.messages || listData.messages.length === 0) {
      return [];
    }

    // Busca detalhes em paralelo
    const detailsPromises = listData.messages.map(msg => 
      fetch(`${GMAIL_API_BASE}/messages/${msg.id}?format=full&_=${Date.now()}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}` }
      }).then(res => res.json() as Promise<GmailMessageDetail>)
    );

    const detailsData = await Promise.all(detailsPromises);

    // Filtra mensagens inválidas e parseia
    return detailsData
      .filter(msg => msg && msg.id) 
      .map(msg => parseGmailMessage(msg));

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
