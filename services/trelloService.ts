
import { TrelloBoard, TrelloList, TrelloCard } from "../types";

const BASE_URL = 'https://api.trello.com/1';

export const fetchBoards = async (key: string, token: string): Promise<TrelloBoard[]> => {
  const response = await fetch(`${BASE_URL}/members/me/boards?key=${key}&token=${token}&fields=name,id`);
  if (!response.ok) throw new Error('Falha ao buscar quadros');
  return response.json();
};

export const fetchLists = async (key: string, token: string, boardId: string): Promise<TrelloList[]> => {
  const response = await fetch(`${BASE_URL}/boards/${boardId}/lists?key=${key}&token=${token}&fields=name,id`);
  if (!response.ok) throw new Error('Falha ao buscar listas');
  return response.json();
};

export const fetchCardsFromList = async (key: string, token: string, listId: string): Promise<TrelloCard[]> => {
  const response = await fetch(`${BASE_URL}/lists/${listId}/cards?key=${key}&token=${token}&fields=name,desc,dateLastActivity,url,labels`);
  if (!response.ok) throw new Error('Falha ao buscar cartões');
  const data = await response.json();
  
  return data.map((card: any) => ({
    id: card.id,
    name: card.name,
    desc: card.desc,
    dateLastActivity: new Date(card.dateLastActivity),
    listId: listId,
    url: card.url,
    labels: card.labels || []
  }));
};
