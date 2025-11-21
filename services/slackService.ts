
export const sendSlackNotification = async (webhookUrl: string, text: string): Promise<boolean> => {
  if (!webhookUrl) return false;

  try {
    // O Slack tem peculiaridades com requisições via navegador (CORS).
    // Enviar como application/x-www-form-urlencoded com payload={json} é a maneira mais compatível
    // com 'no-cors' ou requisições simples que navegadores permitem.
    
    const payload = JSON.stringify({ text });
    const formData = new URLSearchParams();
    formData.append('payload', payload);

    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors', // Importante para evitar bloqueio do navegador
      body: formData
    });
    
    return true;
  } catch (error) {
    console.error('Erro ao enviar notificação para o Slack:', error);
    return false;
  }
};
