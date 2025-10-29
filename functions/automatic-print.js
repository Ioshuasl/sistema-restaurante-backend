import axios from "axios";
import Produto from "../models/produtoModels.js";
import ItemOpcao from "../models/itemOpcaoModels.js"; 
import Config from "../models/configModels.js";
import FormaPagamento from "../models/formaPagamentoModels.js";

/**
 * Envia um pedido recém-criado para o agente de impressão local com dados detalhados.
 *
 * @param {Object} pedido - Instância do pedido criado (Sequelize)
 * @param {Array} produtosPedido - Array vindo do frontend com produtos e suas opções
 * @param {number} taxaEntrega - O valor da taxa de entrega
 */
export async function sendToAutomaticPrint(
    pedido,
    produtosPedido,
    taxaEntrega = 0
) {
    try {
        const config = await Config.findOne();
        if (!config || !config.urlAgenteImpressao || !config.nomeImpressora) {
            console.warn("⚠️ Configuração de impressão incompleta ou não definida.");
            return;
        }

        const { nomeImpressora, urlAgenteImpressao, razaoSocial, cnpj } = config;
        const formaPagamento = await FormaPagamento.findByPk(pedido.formaPagamento_id);
        const subtotal = parseFloat(pedido.valorTotalPedido) - parseFloat(taxaEntrega);

        const pedidoData = {
            printerName: nomeImpressora,
            id: pedido.id,
            createdAt: pedido.createdAt,
            cliente: {
                nome: pedido.nomeCliente,
                telefone: pedido.telefoneCliente,
            },
            empresa: {
                razaoSocial: razaoSocial || "Nome da Empresa",
                cnpj: cnpj || "00.000.000/0000-00",
            },
            itens: await Promise.all(
                produtosPedido.map(async (item) => {
                    const produto = await Produto.findByPk(item.produtoId);
                    if (!produto) return null;

                    // --- INÍCIO DA MUDANÇA ---
                    // 2. Mapeia 'item.opcoesEscolhidas' em vez de 'item.subProdutos'
                    const subItens = await Promise.all(
                        (item.opcoesEscolhidas || []).map(async (opcao) => { 
                            // 3. Busca em 'ItemOpcao' em vez de 'SubProduto'
                            const itemOpcao = await ItemOpcao.findByPk(opcao.itemOpcaoId); 
                            return itemOpcao
                                ? {
                                    // 4. Usa os campos corretos do novo model
                                    nome: itemOpcao.nome, 
                                    quantidade: opcao.quantidade,
                                    valor: parseFloat(itemOpcao.valorAdicional),
                                }
                                : null;
                        })
                    );
                    // --- FIM DA MUDANÇA ---

                    return {
                        produto: produto.nomeProduto,
                        quantidade: item.quantidade,
                        valor: parseFloat(produto.valorProduto),
                        subItens: subItens.filter(Boolean),
                    };
                })
            ).then(items => items.filter(Boolean)), 
            totais: {
                subtotal: subtotal,
                taxaEntrega: parseFloat(taxaEntrega),
                valorTotal: parseFloat(pedido.valorTotalPedido),
            },
            formaPagamento: formaPagamento ? formaPagamento.nomeFormaPagamento : "Não informada",
        };

        try {
            await axios.post(`${urlAgenteImpressao}/print`, pedidoData, {
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                }
            });
            console.log(`🖨️ Pedido #${pedido.id} enviado para ${nomeImpressora} via ${urlAgenteImpressao}/print`);
        } catch (error) {
            console.log("Erro ao conectar ao agente de impressão:", error.response ? error.response.data : error.message);
        }

    } catch (err) {
        console.error("⚠️ Erro ao enviar pedido para impressão automática:", err.message);
    }
}