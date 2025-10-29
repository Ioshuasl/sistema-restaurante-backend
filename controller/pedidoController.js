import sequelize from '../config/database.js';
import Pedido from "../models/pedidoModels.js";
import Produto from '../models/produtoModels.js';
import ItemPedido from '../models/itemPedidoModels.js';
import FormaPagamento from "../models/formaPagamentoModels.js";
import Config from '../models/configModels.js';
import { Sequelize, Op, fn, col, where, literal } from 'sequelize';
import { formatTelefone } from '../functions/formatTelefone.js';
import { sendMessageWhatsapp } from '../functions/sendMessageWhatsapp.js';
import { sendToAutomaticPrint } from '../functions/automatic-print.js';
import ItemOpcao from '../models/itemOpcaoModels.js'; 
import OpcaoItemPedido from '../models/opcaoItemPedidoModels.js';

// --- ASSOCIAÇÕES ATUALIZADAS ---

// Relação FormaPagamento <-> Pedido (Existente)
Pedido.belongsTo(FormaPagamento, { foreignKey: 'formaPagamento_id' });
FormaPagamento.hasMany(Pedido, { foreignKey: 'formaPagamento_id' });

// Relação Pedido <-> ItemPedido (Existente)
Pedido.hasMany(ItemPedido, { foreignKey: 'pedidoId', as: 'itensPedido' });
ItemPedido.belongsTo(Pedido, { foreignKey: 'pedidoId' });

// Relação Produto <-> ItemPedido (Existente)
Produto.hasMany(ItemPedido, { foreignKey: 'produtoId' });
ItemPedido.belongsTo(Produto, { foreignKey: 'produtoId' });

// Relação ItemPedido <-> OpcaoItemPedido (NOVA)
ItemPedido.hasMany(OpcaoItemPedido, { foreignKey: 'itemPedidoId', as: 'opcoesPedido' });
OpcaoItemPedido.belongsTo(ItemPedido, { foreignKey: 'itemPedidoId' });

// Relação ItemOpcao <-> OpcaoItemPedido (NOVA)
ItemOpcao.hasMany(OpcaoItemPedido, { foreignKey: 'itemOpcaoId' });
OpcaoItemPedido.belongsTo(ItemOpcao, { foreignKey: 'itemOpcaoId' });


class PedidoController {

    // Funcao para criar pedido (Refatorada)
    async createPedido({
        produtosPedido, // Formato esperado: [{ produtoId, quantidade, opcoesEscolhidas: [{ itemOpcaoId, quantidade }] }]
        formaPagamento_id,
        situacaoPedido,
        isRetiradaEstabelecimento,
        nomeCliente,
        telefoneCliente,
        cepCliente,
        tipoLogadouroCliente,
        logadouroCliente,
        numeroCliente,
        quadraCliente,
        loteCliente,
        bairroCliente,
        cidadeCliente,
        estadoCliente,
        taxaEntrega
    }) {
        const t = await sequelize.transaction();

        try {
            // 1. Validação da forma de pagamento
            const formaPagamento = await FormaPagamento.findByPk(formaPagamento_id);
            if (!formaPagamento) {
                throw new Error("Forma de pagamento não encontrada ou inválida.");
            }

            // 2. Validação da lista de produtos
            if (!produtosPedido || produtosPedido.length === 0) {
                throw new Error("O pedido deve conter pelo menos um produto.");
            }

            // 3. Criação do pedido principal
            const pedido = await Pedido.create({
                formaPagamento_id,
                isRetiradaEstabelecimento,
                situacaoPedido,
                nomeCliente,
                telefoneCliente,
                cepCliente,
                tipoLogadouroCliente,
                logadouroCliente,
                numeroCliente,
                quadraCliente,
                loteCliente,
                bairroCliente,
                cidadeCliente,
                estadoCliente,
                valorTotalPedido: 0 // Será calculado
            }, { transaction: t });

            let valorTotalCalculado = 0;

            // 4. Loop dos produtos (Itens do Pedido)
            for (const item of produtosPedido) {
                const produto = await Produto.findByPk(item.produtoId);
                if (!produto || !produto.isAtivo) {
                    throw new Error(`Produto com ID ${item.produtoId} não encontrado ou inativo.`);
                }

                const precoProduto = Number(produto.valorProduto);
                const subtotalProduto = precoProduto * item.quantidade;
                valorTotalCalculado += subtotalProduto;

                const itemPedido = await ItemPedido.create({
                    pedidoId: pedido.id,
                    produtoId: item.produtoId,
                    quantidade: item.quantidade,
                    precoUnitario: precoProduto
                }, { transaction: t });

                // 5. Opções (Itens de Opção) vinculadas a esse item (Marmita)
                if (item.opcoesEscolhidas && item.opcoesEscolhidas.length > 0) {
                    for (const opcao of item.opcoesEscolhidas) {
                        // Valida o ItemOpcao (Arroz, Frango, etc.)
                        const itemOpcao = await ItemOpcao.findByPk(opcao.itemOpcaoId);
                        if (!itemOpcao || !itemOpcao.isAtivo) {
                            throw new Error(`Item de Opção com ID ${opcao.itemOpcaoId} não encontrado ou inativo.`);
                        }

                        const precoSub = Number(itemOpcao.valorAdicional) || 0;
                        // Multiplica o adicional pela quantidade do item principal (marmita)
                        // Se uma marmita tem 2x Arroz e o pedido tem 3x marmitas, serão 6x o preço adicional do arroz.
                        // Assumindo que a 'quantidade' em 'opcao' é por marmita.
                        const subtotalSub = precoSub * (opcao.quantidade || 1) * item.quantidade;
                        valorTotalCalculado += subtotalSub;

                        await OpcaoItemPedido.create({
                            itemPedidoId: itemPedido.id,
                            itemOpcaoId: opcao.itemOpcaoId,
                            quantidade: opcao.quantidade || 1,
                            precoAdicional: precoSub
                        }, { transaction: t });
                    }
                }
            }

            // 6. Adiciona taxa de entrega
            valorTotalCalculado += Number(taxaEntrega) || 0;

            // 7. Atualiza total do pedido
            pedido.valorTotalPedido = valorTotalCalculado;
            await pedido.save({ transaction: t });

            // 8. Confirma a transação
            await t.commit();

            // 9. Envia pedido para impressão (a função sendToAutomaticPrint também precisará ser ajustada)
            try {
                // NOTA: A função 'sendToAutomaticPrint' provavelmente quebrou,
                // pois ela espera 'subProdutos'. Você precisará ajustá-la
                // para receber 'opcoesEscolhidas' ou adaptar os dados aqui.
                await sendToAutomaticPrint(pedido, produtosPedido, taxaEntrega);
            } catch (error) {
                console.error("Erro na chamada de impressão (pode precisar de refatoração):", error);
            }

            // 10. Envia mensagem no whatsapp
            try {
                const config = await Config.findOne({ where: { id: 1 } }); 
                if (!config || !config.evolutionInstanceName) {
                    console.warn("Configuração da Evolution API não encontrada. Mensagem WhatsApp não será enviada.");
                } else {
                    const mensagens = [
                        `Olá ${nomeCliente}, seu pedido foi criado com sucesso!`,
                        `Número do pedido: ${pedido.id}`,
                        `Valor total: R$ ${valorTotalCalculado.toFixed(2)}`,
                        `Obrigado pela preferência! 🍽️`
                    ];
                    const telefoneFormatado = formatTelefone(telefoneCliente);
                    await sendMessageWhatsapp(
                        process.env.EVOLUTION_API_URL,
                        config.evolutionInstanceName,
                        process.env.EVOLUTION_API_KEY,
                        telefoneFormatado,
                        mensagens,
                        2000
                    );
                }
            } catch (err) {
                console.error("Erro ao enviar mensagem WhatsApp:", err.message);
            }

            return pedido;

        } catch (error) {
            await t.rollback();
            console.error("Erro ao criar pedido:", error.message);
            throw new Error(`Erro ao criar pedido: ${error.message}`);
        }
    }

    // Funcao de Impressão (Refatorada)
    async printPedido(id) {
        try {
            // 1. Busca o pedido com os novos relacionamentos
            const pedido = await Pedido.findByPk(id, {
                include: [{
                    model: ItemPedido,
                    as: 'itensPedido',
                    include: [
                        { model: Produto },
                        {
                            model: OpcaoItemPedido,
                            as: 'opcoesPedido', // <-- NOVO ALIAS
                            include: [{ model: ItemOpcao }] // <-- NOVO MODEL
                        }
                    ]
                }]
            });

            if (!pedido) {
                throw new Error("Pedido não encontrado.");
            }

            // 2. Busca a taxa de entrega
            const config = await Config.findOne();
            const taxaEntrega = config ? config.taxaEntrega : 0;

            // 3. Reconstrói 'produtosPedido' para a função de impressão
            const produtosPedido = pedido.itensPedido.map(item => {
                return {
                    produtoId: item.produtoId,
                    quantidade: item.quantidade,
                    // Ajusta para o novo formato
                    opcoesEscolhidas: item.opcoesPedido.map(opcao => {
                        return {
                            itemOpcaoId: opcao.itemOpcaoId,
                            quantidade: opcao.quantidade
                        };
                    })
                };
            });

            // 4. Chama a função de impressão (que também precisa ser adaptada)
            await sendToAutomaticPrint(pedido, produtosPedido, taxaEntrega);

            return { success: true, message: `Pedido #${id} enviado para impressão.` };

        } catch (error) {
            console.error("Erro ao tentar imprimir pedido:", error.message);
            return { success: false, message: error.message };
        }
    }

    // Funcao de busca (Refatorada)
    async findAndCountAllPedidos() {
        try {
            const pedidos = await Pedido.findAndCountAll({
                include: [{
                    model: ItemPedido,
                    as: 'itensPedido',
                    include: [
                        {
                            model: Produto,
                            attributes: ['nomeProduto']
                        },
                        {
                            model: OpcaoItemPedido,
                            as: 'opcoesPedido', // <-- NOVO ALIAS
                            include: [
                                {
                                    model: ItemOpcao, // <-- NOVO MODEL
                                    attributes: ['nome'] // Nome do item (Ex: Arroz)
                                }
                            ]
                        }
                    ]
                }],
                order: [['id', 'DESC']]
            });
            return pedidos;
        } catch (error) {
            console.error(error);
            return { message: "Erro ao tentar encontrar pedidos", error };
        }
    }

    // Funcao de busca (Refatorada)
    async findAllPedidos() {
        try {
            const pedidos = await Pedido.findAll({
                include: [{
                    model: ItemPedido,
                    as: 'itensPedido',
                    include: [
                        {
                            model: Produto,
                            attributes: ['nomeProduto']
                        },
                        {
                            model: OpcaoItemPedido,
                            as: 'opcoesPedido', // <-- NOVO ALIAS
                            include: [
                                {
                                    model: ItemOpcao, // <-- NOVO MODEL
                                    attributes: ['nome']
                                }
                            ]
                        }
                    ]
                }]
            });
            return pedidos;
        } catch (error) {
            console.error(error);
            return { message: "Erro ao tentar encontrar pedidos", error };
        }
    }

    // --- Funções de Dashboard (Não precisam de mudança) ---
    
    async countAllPedidos() {
        try {
            const pedidos = Pedido.count();
            return pedidos;
        } catch (error) {
            return { message: "Erro ao tentar encontrar pedidos", error };
        }
    }

    async getMonthlyRevenue(year, month) {
        try {
            const result = await Pedido.findOne({
                attributes: [
                    [fn('SUM', col('valorTotalPedido')), 'totalRevenue']
                ],
                where: {
                    [Op.and]: [
                        where(literal('EXTRACT(YEAR FROM "createdAt")'), Number(year)),
                        where(literal('EXTRACT(MONTH FROM "createdAt")'), Number(month))
                    ]
                },
                raw: true
            });
            const totalRevenue = parseFloat(result.totalRevenue) || 0;
            return { totalRevenue };
        } catch (error) {
            console.error(error);
            return { message: "Erro ao tentar calcular o rendimento mensal", error };
        }
    }

    async getMonthlyOrderCounts() {
        try {
            const monthlyCounts = await Pedido.findAll({
                attributes: [
                    [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('createdAt')), 'month'],
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                ],
                group: [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('createdAt'))],
                order: [[sequelize.fn('DATE_TRUNC', 'month', sequelize.col('createdAt')), 'ASC']]
            });
            return monthlyCounts;
        } catch (error) {
            console.error(error);
            return { message: "Erro ao tentar obter a contagem de pedidos mensais", error };
        }
    }

    async getPaymentMethodDistribution() {
        try {
            const distribution = await FormaPagamento.findAll({
                attributes: [
                    'id',
                    'nomeFormaPagamento',
                    [Sequelize.fn('COUNT', Sequelize.col('pedidos.id')), 'count']
                ],
                include: [
                    {
                        model: Pedido,
                        as: 'pedidos',
                        attributes: []
                    }
                ],
                group: ['FormaPagamento.id', 'FormaPagamento.nomeFormaPagamento'],
                order: [['nomeFormaPagamento', 'ASC']]
            });
            const formattedDistribution = distribution.map(item => ({
                label: item.nomeFormaPagamento,
                value: parseInt(item.getDataValue('count'), 10)
            }));
            return formattedDistribution;
        } catch (error) {
            console.error(error);
            return { message: "Erro ao tentar obter a distribuição por forma de pagamento", error };
        }
    }

    // --- Funções de CRUD simples (Não precisam de mudança) ---
    
    async findPedidoById(id) {
        try {
            const pedido = await Pedido.findByPk(id);
            return pedido;
        } catch (error) {
            console.error(error);
            return { message: "Erro tentar encontrar o pedido", error };
        }
    }

    async findPedidosByFormaPagamento(formaPagamento_id) {
        try {
            const pedidos = await Pedido.findAll({
                where: {
                    formaPagamento_id: formaPagamento_id
                }
            });
            return pedidos;
        } catch (error) {
            console.error(error);
            return { message: "Erro ao tentar encontrar os pedidos", error };
        }
    }

    async updatePedido(updatedData, id) {
        try {
            const pedido = await Pedido.update(updatedData, {
                where: {
                    id: id
                }
            });
            return pedido;
        } catch (error) {
            console.error(error);
            return { message: "Erro ao tentar atualizar um pedido", error };
        }
    }
}

export default new PedidoController();