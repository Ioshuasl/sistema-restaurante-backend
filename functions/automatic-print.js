// functions/automatic-print.js
import axios from "axios";
import Produto from "../models/produtoModels.js";
import SubProduto from "../models/subProdutoModels.js";
import Config from "../models/configModels.js";
import FormaPagamento from "../models/formaPagamentoModels.js";

export async function sendToAutomaticPrint(
    pedido,
    produtosPedido,
    taxaEntrega = 0
) {
    try {
        const config = await Config.findOne();
        if (!config || !config.urlAgenteImpressao || !config.nomeImpressora) {
            console.warn("⚠️ Configuração de impressão incompleta.");
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
            // Observação Geral do Pedido
            observacaoGeral: pedido.observacao || "Sem observações",
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
                        // --- CAMPO ADICIONADO AQUI ---
                        // Captura a observação específica que o cliente deixou para este item
                        observacaoItem: item.observacaoItem || "", 
                        // -----------------------------
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
            console.log(`🖨️ Cupom do Pedido #${pedido.id} enviado com observações por item.`);
        } catch (error) {
            console.error("Erro no agente de impressão:", error.message);
        }

    } catch (err) {
        console.error("⚠️ Erro na função de impressão:", err.message);
    }
}