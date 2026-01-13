// controller/webhookController.js
import WhatsappCliente from '../models/whatsappClienteModel.js';
import { sendMessageWhatsapp } from '../functions/sendMessageWhatsapp.js';
import Config from '../models/configModels.js';

export const handleIncomingMessage = async (req, res) => {
  try {
    console.log('\n--- 🔔 NOVO WEBHOOK RECEBIDO ---');
    
    const { data, event, instance } = req.body;
    
    // Log básico
    console.log(`📡 Evento: ${event}`);
    console.log(`🤖 Instância (Webhook): ${instance}`);

    if (event !== 'messages.upsert') {
      return res.status(200).send('Evento ignorado');
    }

    const messageData = data.data || data; 

    if (!messageData || !messageData.key) {
      return res.status(200).send('Sem dados');
    }

    const remoteJid = messageData.key.remoteJid;
    const isFromMe = messageData.key.fromMe;
    const isGroup = remoteJid.includes('@g.us');
    
    // --- CAPTURA DO NOME (PUSHNAME) ---
    // A Evolution costuma mandar em data.pushName ou messageData.pushName
    const pushName = messageData.pushName || data.pushName || null;

    if (isFromMe || isGroup) {
      return res.status(200).send('Ignorado');
    }

    const numeroApenasDigitos = remoteJid.replace('@s.whatsapp.net', '');
    const hoje = new Date().toISOString().split('T')[0];

    console.log(`🔎 Cliente: ${numeroApenasDigitos} | Nome: ${pushName || 'Desconhecido'}`);

    // 2. Verifica/Atualiza no banco
    let cliente = await WhatsappCliente.findOne({ where: { numero: numeroApenasDigitos } });
    let enviarCardapio = false;

    if (!cliente) {
      console.log('🆕 Cliente NOVO. Criando registro com nome...');
      cliente = await WhatsappCliente.create({
        numero: numeroApenasDigitos,
        nome: pushName, // Salva o nome capturado
        ultima_interacao: hoje
      });
      enviarCardapio = true;
    } else {
      // Se o cliente já existe, verificamos a data
      if (cliente.ultima_interacao !== hoje) {
        console.log('✅ Retorno em NOVO dia. Atualizando...');
        
        // Atualizamos a data E o nome (caso ele tenha mudado o nome no WhatsApp)
        await cliente.update({ 
            ultima_interacao: hoje,
            nome: pushName || cliente.nome // Prioriza o novo nome, senão mantem o antigo
        });
        enviarCardapio = true;
      } else {
        console.log('⏳ Cliente já interagiu hoje.');
      }
    }

    // 3. Envia a resposta automática (DINÂMICA)
    if (enviarCardapio) {
      const config = await Config.findOne({ where: { id: 1 } });

      if (!config || !config.evolutionInstanceName) {
        console.error('❌ ERRO: Configuração de instância ausente.');
        return res.status(500).send('Erro config');
      }

      // --- LÓGICA DA MENSAGEM DINÂMICA ---
      // Se tiver nome: "Olá, João!..."
      // Se não tiver: "Olá!..."
      const saudacao = cliente.nome ? `Olá, *${cliente.nome}*!` : `Olá!`;

      const mensagemBoasVindas = [
        `${saudacao} Tudo bem?`, // Mensagem personalizada
        `Para realizar seu pedido, acesse nosso cardápio digital no link: https://gs-sabores.ioshuavps.com.br`,
      ];

      console.log(`🚀 Enviando para ${cliente.nome || numeroApenasDigitos}...`);

      await sendMessageWhatsapp(
        process.env.EVOLUTION_API_URL, 
        config.evolutionInstanceName,
        process.env.EVOLUTION_API_KEY, 
        numeroApenasDigitos, 
        mensagemBoasVindas, 
        2000 
      );
      
      console.log(`✅ Cardápio enviado!`);
    }

    return res.status(200).json({ status: 'success' });

  } catch (error) {
    console.error('❌ ERRO WEBHOOK:', error);
    return res.status(500).json({ error: 'Erro interno' });
  }
};