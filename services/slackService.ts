
export const sendSlackNotification = async (webhookUrl: string, text: string): Promise<void> => {
  if (!webhookUrl) return;

  try {
    // O Slack aceita POST com JSON contendo a propriedade 'text'
    // Usamos 'no-cors' para evitar bloqueios de navegador em requisições client-side,
    // embora isso signifique que não saberemos com certeza se deu 200 OK, o disparo é feito.
    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors', 
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
  } catch (error) {
    console.error('Erro ao enviar notificação para o Slack:', error);
  }
};
