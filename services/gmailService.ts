
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
  labelIds: string[];
  snippet: string;
  internalDate: string;
  payload: GmailMessagePart;
}

interface GmailListResponse {
  messages: { id: string; threadId: string }[];
  nextPageToken?: string;
  resultSizeEstimate: number;
}

/**
 * Busca os e-mails mais recentes da caixa de entrada.
 */
export const fetchGmailMessages = async (accessToken: string, maxResults: number = 10): Promise<EmailMessage[]> => {
  try {
    // 1. Buscar lista de IDs de mensagens na Inbox
    // cache: 'no-store' é CRUCIAL na Vercel/Mobile para evitar que ele mostre dados antigos
    const listResponse = await fetch(
      `${GMAIL_API_BASE}/messages?maxResults=${maxResults}&q=label:inbox&_=${Date.now()}`,
      {
        method: 'GET',
        cache: 'no-store', // Força o navegador a não usar cache
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );

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

    // 2. Buscar detalhes de cada mensagem (em paralelo)
    const detailsPromises = listData.messages.map(msg => 
      fetch(`${GMAIL_API_BASE}/messages/${msg.id}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}` }
      }).then(res => res.json() as Promise<GmailMessageDetail>)
    );

    const detailsData = await Promise.all(detailsPromises);

    // 3. Converter para o formato do app
    return detailsData.map(msg => parseGmailMessage(msg));

  } catch (error: any) {
    console.error("Erro no fetch do Gmail:", error);
    throw error;
  }
};

/**
 * Helper para extrair dados relevantes do JSON complexo do Gmail.
 */
const parseGmailMessage = (msg: GmailMessageDetail): EmailMessage => {
  const headers = msg.payload.headers;
  
  const getHeader = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
  
  const subject = getHeader('Subject') || '(Sem Assunto)';
  const from = getHeader('From');
  
  // Limpa o remetente para pegar apenas o nome se possível
  // Ex: "Google <no-reply@google.com>" -> "Google"
  const cleanSender = from.split('<')[0].trim().replace(/"/g, '') || from;

  const isUnread = msg.labelIds.includes('UNREAD');
  
  // Determina label visual baseado nas categorias do Gmail
  let label: 'Primary' | 'Updates' | 'Promotions' = 'Primary';
  if (msg.labelIds.includes('CATEGORY_UPDATES')) label = 'Updates';
  if (msg.labelIds.includes('CATEGORY_PROMOTIONS')) label = 'Promotions';

  return {
    id: msg.id,
    sender: cleanSender,
    subject: subject,
    snippet: msg.snippet, // Gmail já fornece um snippet decodificado
    date: new Date(parseInt(msg.internalDate)),
    isUnread,
    label
  };
};
