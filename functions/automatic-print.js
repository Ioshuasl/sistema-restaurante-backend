// functions/automatic-print.js
import axios from "axios";
import Config from "../models/configModels.js";
import FormaPagamento from "../models/formaPagamentoModels.js";

export async function sendToAutomaticPrint(pedido, produtosPedido = [], taxaEntrega = 0) {
    try {
        const config = await Config.findOne();
        if (!config || !config.urlAgenteImpressao || !config.nomeImpressora) {
            console.warn("⚠️ Configuração de impressão incompleta.");
            return;
        }

        const { nomeImpressora, urlAgenteImpressao, razaoSocial, cnpj } = config;
        
        // Busca o nome da forma de pagamento pelo ID (já que o JSON só traz o ID)
        const formaPagamentoModel = await FormaPagamento.findByPk(pedido.formaPagamento_id);
        const nomeFormaPagamento = formaPagamentoModel ? formaPagamentoModel.nomeFormaPagamento : "Não informada";

        const subtotal = parseFloat(pedido.valorTotalPedido) - parseFloat(taxaEntrega);

        // Formata o endereço se for entrega
        let enderecoEntrega = null;
        if (!pedido.isRetiradaEstabelecimento) {
            enderecoEntrega = {
                logadouro: pedido.logadouroCliente,
                numero: pedido.numeroCliente,
                bairro: pedido.bairroCliente,
                cidade: pedido.cidadeCliente,
                estado: pedido.estadoCliente,
                cep: pedido.cepCliente,
                complemento: pedido.complementoCliente
            };
        }

        // Mapeamento dos itens baseado na NOVA estrutura JSON (pedido.itensPedido)
        // Nota: Se 'produtosPedido' vier vazio, usamos 'pedido.itensPedido' que é a nova estrutura
        const listaItens = pedido.itensPedido || [];

        const itensFormatados = listaItens.map((item) => {
            // Mapeia os subitens (adicionais)
            const subItens = (item.subItensPedido || []).map((sub) => {
                return {
                    nome: sub.subproduto ? sub.subproduto.nomeSubProduto : "Adicional",
                    quantidade: sub.quantidade,
                    valor: parseFloat(sub.precoAdicional || 0),
                };
            });

            return {
                produto: item.produto ? item.produto.nomeProduto : "Item não identificado",
                quantidade: item.quantidade,
                valor: parseFloat(item.precoUnitario || 0),
                observacaoItem: item.observacaoItem || "",
                subItens: subItens,
            };
        });

        const pedidoData = {
            printerName: nomeImpressora,
            id: pedido.id,
            createdAt: pedido.createdAt,
            tipoEntrega: pedido.isRetiradaEstabelecimento ? "RETIRADA" : "ENTREGA",
            cliente: {
                nome: pedido.nomeCliente,
                telefone: pedido.telefoneCliente,
                endereco: enderecoEntrega // Novo campo de objeto
            },
            empresa: {
                razaoSocial: razaoSocial || "Nome da Empresa",
                cnpj: cnpj || "00.000.000/0000-00",
            },
            observacaoGeral: pedido.observacao || "",
            itens: itensFormatados,
            totais: {
                subtotal: subtotal,
                taxaEntrega: parseFloat(taxaEntrega),
                valorTotal: parseFloat(pedido.valorTotalPedido),
            },
            formaPagamento: nomeFormaPagamento,
        };

        console.log("Enviando dados para impressão automática:", JSON.stringify(pedidoData, null, 2));

        try {
            await axios.post(`${urlAgenteImpressao}/print`, pedidoData, {
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                }
            });
            console.log(`🖨️ Cupom do Pedido #${pedido.id} enviado para o agente.`);
        } catch (error) {
            console.error("Erro no agente de impressão:", error.message);
        }

    } catch (err) {
        console.error("⚠️ Erro na função de impressão:", err.message);
    }
}