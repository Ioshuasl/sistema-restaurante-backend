import axios from "axios";

/**
 * Envia uma ou várias mensagens via API WhatsApp (Evolution API)
 * 
 * @param {string} url - URL base da API (ex: https://seu-dominio.com)
 * @param {string} instanceName - Nome da instância
 * @param {string} apikey - Chave da API
 * @param {string} numero - Número do destinatário (ex: 5511999999999)
 * @param {string[]} mensagens - Array de mensagens que serão enviadas
 * @param {number|null} delay - Tempo em milissegundos entre cada mensagem (se null, será 0)
 */
export async function sendMessageWhatsapp(url, instanceName, apikey, numero, mensagens, delay = 0) {
  if (!Array.isArray(mensagens) || mensagens.length === 0) {
    console.log(mensagens)
    console.error("O parâmetro 'mensagens' deve ser um array com pelo menos uma mensagem.");
    return;
  }

  const endpoint = `${url}/message/sendText/${instanceName}`;
  const tempoDelay = delay ?? 0; // Caso seja null, vira 0

  for (let i = 0; i < mensagens.length; i++) {
    const message = mensagens[i];

    try {
      const response = await axios.post(
        endpoint,
        {
          number: numero,
          text: message,
        },
        {
          headers: {
            "Content-Type": "application/json",
            apikey: apikey,
          },
        }
      );

      console.log(`✅ Mensagem ${i + 1}/${mensagens.length} enviada com sucesso!`);
      console.log(response.data);

      // Se houver mais mensagens e delay for maior que 0, aguarda o tempo definido
      if (i < mensagens.length - 1 && tempoDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, tempoDelay));
      }

    } catch (error) {
      console.error(`❌ Erro ao enviar a mensagem ${i + 1}:`, error.response?.data || error.message);
    }
  }
}
