import axios from "axios";
import Produto from "../models/produtoModels.js";
import SubProduto from "../models/subProdutoModels.js";
import Config from "../models/configModels.js";
import FormaPagamento from "../models/formaPagamentoModels.js";

/**
 * Envia um pedido recém-criado para o agente de impressão local com dados detalhados.
 *
 * @param {Object} pedido - Instância do pedido criado (Sequelize)
 * @param {Array} produtosPedido - Array vindo do frontend com produtos e subprodutos
 * @param {number} taxaEntrega - O valor da taxa de entrega
 */
export async function sendToAutomaticPrint(
    pedido,
    produtosPedido,
    taxaEntrega = 0
) {
    try {
        // Busca a configuração global (empresa, impressora, etc.)
        const config = await Config.findOne();
        if (!config || !config.urlAgenteImpressao || !config.nomeImpressora) {
            console.warn("⚠️ Configuração de impressão incompleta ou não definida.");
            return;
        }

        const { nomeImpressora, urlAgenteImpressao, razaoSocial, cnpj } = config;

        // Busca o nome da forma de pagamento
        const formaPagamento = await FormaPagamento.findByPk(pedido.formaPagamento_id);

        // Calcula o subtotal (Total - Taxa de Entrega)
        const subtotal = parseFloat(pedido.valorTotalPedido) - parseFloat(taxaEntrega);

        // Monta o JSON que será enviado ao agente local
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

                    const subItens = await Promise.all(
                        item.subProdutos.map(async (sub) => {
                            const subProduto = await SubProduto.findByPk(sub.subProdutoId);
                            return subProduto
                                ? {
                                    nome: subProduto.nomeSubProduto,
                                    quantidade: sub.quantidade,
                                    valor: parseFloat(subProduto.valorAdicional),
                                }
                                : null;
                        })
                    );

                    return {
                        produto: produto.nomeProduto,
                        quantidade: item.quantidade,
                        valor: parseFloat(produto.valorProduto),
                        subItens: subItens.filter(Boolean),
                    };
                })
            ).then(items => items.filter(Boolean)), // Garante que itens nulos sejam removidos
            totais: {
                subtotal: subtotal,
                taxaEntrega: parseFloat(taxaEntrega),
                valorTotal: parseFloat(pedido.valorTotalPedido),
            },
            formaPagamento: formaPagamento ? formaPagamento.nomeFormaPagamento : "Não informada",
        };

        // Envia para o agente de impressão local — rota fixa /print
        await axios.post(`${urlAgenteImpressao}/print`, pedidoData);

        console.log(`🖨️ Pedido #${pedido.id} enviado para ${nomeImpressora} via ${urlAgenteImpressao}/print`);
    } catch (err) {
        console.error("⚠️ Erro ao enviar pedido para impressão automática:", err.message);
    }
}