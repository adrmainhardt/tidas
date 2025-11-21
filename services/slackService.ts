
import { SlackMessage } from "../types";

const SLACK_API_BASE = 'https://slack.com/api';

// Cache simples de usuários para não buscar toda vez
let userCache: Record<string, { name: string, image: string }> = {};

/**
 * Helper seguro para fetch no Slack
 */
const safeFetchSlack = async (endpoint: string, token: string): Promise<any> => {
    try {
        const response = await fetch(`${SLACK_API_BASE}/${endpoint}`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` }
        });
        return await response.json();
    } catch (error) {
        // Identifica erro de rede/CORS
        throw new Error('NETWORK_ERROR');
    }
};

/**
 * Busca a lista de usuários para mapear IDs para Nomes
 */
const fetchUsers = async (token: string) => {
  if (Object.keys(userCache).length > 0) return;
  
  try {
    const data = await safeFetchSlack('users.list', token);
    if (data.ok && data.members) {
        data.members.forEach((m: any) => {
            userCache[m.id] = {
                name: m.real_name || m.name,
                image: m.profile?.image_48 || ''
            };
        });
    }
  } catch (e) {
    // Silently fail for users list to avoid noise, fallback to ID
    console.warn("Aviso: Não foi possível carregar lista de usuários Slack (provável bloqueio CORS).");
  }
};

/**
 * Busca as conversas diretas (IMs) mais recentes
 */
export const fetchSlackDMs = async (token: string): Promise<SlackMessage[]> => {
  if (!token) return [];

  try {
    // 1. Tenta buscar usuários (não bloqueante)
    await fetchUsers(token);

    // 2. Busca canais de DM
    let listData;
    try {
        listData = await safeFetchSlack('conversations.list?types=im,mpim&limit=20&exclude_archived=true', token);
    } catch (e) {
        throw new Error("CORS_ERROR");
    }
    
    if (!listData.ok) {
        if (listData.error === 'missing_scope') throw new Error('MISSING_SCOPE');
        if (listData.error === 'invalid_auth') throw new Error('INVALID_TOKEN');
        console.warn("Slack API Error:", listData.error);
        return [];
    }

    const channels = listData.channels || [];
    
    // 3. Busca histórico (limitado a 5 para performance e evitar muitos requests bloqueados)
    const activeChannels = channels.slice(0, 5);

    const historyPromises = activeChannels.map(async (channel: any) => {
        try {
            const histData = await safeFetchSlack(`conversations.history?channel=${channel.id}&limit=1`, token);
            
            if (histData.ok && histData.messages && histData.messages.length > 0) {
                const lastMsg = histData.messages[0];
                const otherUserId = lastMsg.user; 
                const userInfo = userCache[otherUserId] || { name: 'Usuário Slack', image: '' };
                
                return {
                    id: lastMsg.ts,
                    userId: otherUserId,
                    userName: userInfo.name,
                    avatar: userInfo.image,
                    text: lastMsg.text,
                    timestamp: new Date(parseFloat(lastMsg.ts) * 1000),
                    isRead: false, 
                    channelId: channel.id
                } as SlackMessage;
            }
        } catch (e) {
            // Ignora falhas individuais de canal
        }
        return null;
    });

    const results = await Promise.all(historyPromises);
    return results.filter((m): m is SlackMessage => m !== null).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  } catch (error: any) {
    // Repassa erros conhecidos, loga outros
    if (error.message === 'CORS_ERROR' || error.message === 'MISSING_SCOPE' || error.message === 'INVALID_TOKEN') {
        throw error;
    }
    console.warn('Erro genérico SlackService:', error);
    throw error;
  }
};

/**
 * Envia notificação
 */
export const sendSlackNotification = async (token: string, text: string, channelId: string = 'general'): Promise<boolean> => {
  if (!token) return false;

  try {
    // Tenta usar fetch POST. Se falhar por CORS, infelizmente não há muito o que fazer no front puro sem proxy.
    const response = await fetch(`${SLACK_API_BASE}/chat.postMessage`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ channel: channelId, text: text })
    });
    
    // Se a resposta for opaca (mode: no-cors) ou erro de rede, cairá no catch
    const data = await response.json();
    return data.ok;
  } catch (error) {
    console.warn('Falha no envio Slack (Provável CORS):', error);
    return false;
  }
};
