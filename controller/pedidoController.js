import sequelize from '../config/database.js'; // Importe a instância do sequelize
import Pedido from "../models/pedidoModels.js"
import Produto from '../models/produtoModels.js';
import ItemPedido from '../models/itemPedidoModels.js';
import FormaPagamento from "../models/formaPagamentoModels.js"
import Config from '../models/configModels.js';
import SubItemPedido from '../models/SubItemPedidoModels.js';
import { Sequelize, Op, fn, col, where, literal } from 'sequelize';
import SubProduto from '../models/subProdutoModels.js';
import { formatTelefone } from '../functions/formatTelefone.js';
import { sendMessageWhatsapp } from '../functions/sendMessageWhatsapp.js';
import { sendToAutomaticPrint } from '../functions/automatic-print.js';

// Relação FormaPagamento <-> Pedido
Pedido.belongsTo(FormaPagamento, { foreignKey: 'formaPagamento_id' });
FormaPagamento.hasMany(Pedido, { foreignKey: 'formaPagamento_id' });

// Relação Pedido <-> ItemPedido
Pedido.hasMany(ItemPedido, { foreignKey: 'pedidoId', as: 'itensPedido' });
ItemPedido.belongsTo(Pedido, { foreignKey: 'pedidoId' });

// Relação Produto <-> ItemPedido
Produto.hasMany(ItemPedido, { foreignKey: 'produtoId' });
ItemPedido.belongsTo(Produto, { foreignKey: 'produtoId' });

// Relação ItemPedido <-> SubItemPedido
ItemPedido.hasMany(SubItemPedido, { foreignKey: 'itemPedidoId', as: 'subItensPedido' });
SubItemPedido.belongsTo(ItemPedido, { foreignKey: 'itemPedidoId' });

// Relação SubProduto <-> SubItemPedido
SubProduto.hasMany(SubItemPedido, { foreignKey: 'subProdutoId' });
SubItemPedido.belongsTo(SubProduto, { foreignKey: 'subProdutoId' });

class PedidoController {

    //funcao para criar pedido
    async createPedido({
        produtosPedido,
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
                valorTotalPedido: 0
            }, { transaction: t });

            let valorTotalCalculado = 0;

            // 4. Loop dos produtos
            for (const item of produtosPedido) {
                const produto = await Produto.findByPk(item.produtoId);
                if (!produto || !produto.isAtivo) {
                    throw new Error(`Produto com ID ${item.produtoId} não encontrado ou inativo.`);
                }

                const precoProduto = Number(produto.valorProduto);
                const subtotalProduto = precoProduto * item.quantidade;
                valorTotalCalculado += subtotalProduto;
                console.log(valorTotalCalculado)

                const itemPedido = await ItemPedido.create({
                    pedidoId: pedido.id,
                    produtoId: item.produtoId,
                    quantidade: item.quantidade,
                    precoUnitario: precoProduto
                }, { transaction: t });

                // 5. Subprodutos vinculados a esse item
                if (item.subProdutos && item.subProdutos.length > 0) {
                    for (const sub of item.subProdutos) {
                        const subProduto = await SubProduto.findByPk(sub.subProdutoId);
                        if (!subProduto || !subProduto.isAtivo) {
                            throw new Error(`Subproduto com ID ${sub.subProdutoId} não encontrado ou inativo.`);
                        }

                        const precoSub = Number(subProduto.valorAdicional) || 0;
                        const subtotalSub = precoSub * sub.quantidade;
                        valorTotalCalculado += subtotalSub;
                        console.log(valorTotalCalculado)

                        await SubItemPedido.create({
                            itemPedidoId: itemPedido.id,
                            subProdutoId: sub.subProdutoId,
                            quantidade: sub.quantidade,
                            precoAdicional: precoSub
                        }, { transaction: t });
                    }
                }
            }

            // 6. Adiciona taxa de entrega
            console.log("Valor da entrega", taxaEntrega, "Tipo do atributo taxa de entrega", typeof (taxaEntrega))
            valorTotalCalculado += Number(taxaEntrega);

            // 7. Atualiza total do pedido
            pedido.valorTotalPedido = valorTotalCalculado;
            await pedido.save({ transaction: t });

            // 8. Confirma a transação
            await t.commit();

            // 9. Envia pedido para impressão
            try {
                await sendToAutomaticPrint(pedido, produtosPedido, taxaEntrega)
            } catch (error) {
                console.error("Erro na chamada de impressão:", error);
            }

            // 9. Envia mensagem no whatsapp do cliente para confirmação do pedido
            try {
                // Buscar a configuração para pegar o nome da instância Evolution API
                const config = await Config.findOne({ where: { id: 1 } }); // ajuste o id conforme seu caso

                if (!config || !config.evolutionInstanceName) {
                    console.warn("Configuração da Evolution API não encontrada. Mensagem WhatsApp não será enviada.");
                } else {
                    // Montar mensagem para o cliente
                    const mensagens = [
                        `Olá ${nomeCliente}, seu pedido foi criado com sucesso!`,
                        `Número do pedido: ${pedido.id}`,
                        `Valor total: R$ ${valorTotalCalculado.toFixed(2)}`,
                        `Obrigado pela preferência! 🍽️`
                    ];

                    const telefoneFormatado = formatTelefone(telefoneCliente)

                    // Enviar mensagem
                    await sendMessageWhatsapp(
                        process.env.EVOLUTION_API_URL,
                        config.evolutionInstanceName,
                        process.env.EVOLUTION_API_KEY,
                        telefoneFormatado,
                        mensagens,
                        2000 // delay de 2 segundos entre mensagens
                    );
                }
            } catch (err) {
                // Log de erro, mas não impacta a resposta do pedido
                console.error("Erro ao enviar mensagem WhatsApp:", err.message);
            }

            return pedido;

        } catch (error) {
            await t.rollback();
            console.error("Erro ao criar pedido:", error.message);
            throw new Error(`Erro ao criar pedido: ${error.message}`);
        }
    }

    async printPedido(id) {
        try {
            // 1. Busca o pedido com todos os seus relacionamentos
            const pedido = await Pedido.findByPk(id, {
                include: [{
                    model: ItemPedido,
                    as: 'itensPedido',
                    include: [
                        { model: Produto },
                        {
                            model: SubItemPedido,
                            as: 'subItensPedido',
                            include: [{ model: SubProduto }]
                        }
                    ]
                }]
            });

            if (!pedido) {
                throw new Error("Pedido não encontrado.");
            }

            // 2. Busca a taxa de entrega nas configurações
            const config = await Config.findOne();
            const taxaEntrega = config ? config.taxaEntrega : 0;

            // 3. Reconstrói o array 'produtosPedido' no formato esperado pela função de impressão
            const produtosPedido = pedido.itensPedido.map(item => {
                return {
                    produtoId: item.produtoId,
                    quantidade: item.quantidade,
                    subProdutos: item.subItensPedido.map(subItem => {
                        return {
                            subProdutoId: subItem.subProdutoId,
                            quantidade: subItem.quantidade
                        };
                    })
                };
            });

            // 4. Chama a função de impressão
            await sendToAutomaticPrint(pedido, produtosPedido, taxaEntrega);

            return { success: true, message: `Pedido #${id} enviado para impressão.` };

        } catch (error) {
            console.error("Erro ao tentar imprimir pedido:", error.message);
            return { success: false, message: error.message };
        }
    }

    //funcao para encontrar e contar todos os pedidos cadastrados na aplicacao
    async findAndCountAllPedidos() {
        try {
            const pedidos = await Pedido.findAndCountAll({
                include: [{
                    model: ItemPedido,
                    as: 'itensPedido',  // use o alias correto
                    include: [
                        {
                            model: Produto,
                            attributes: ['nomeProduto']
                        },
                        {
                            model: SubItemPedido,
                            as: 'subItensPedido',  // alias para subItensPedido
                            include: [
                                {
                                    model: SubProduto,
                                    attributes: ['nomeSubProduto']
                                }
                            ]
                        }
                    ]
                }],
                order: [['id', 'DESC']]  // Ordena por ID de forma decrescente
            });
            return pedidos
        } catch (error) {
            console.error(error)
            return { message: "Erro ao tentar encontrar pedidos", error }
        }
    }

    //funcao para encontrar todos os pedidos cadastrados na aplicacao
    async findAllPedidos() {
        try {
            const pedidos = await Pedido.findAll({
                include: [{
                    model: ItemPedido,
                    as: 'itensPedido',  // use o alias correto
                    include: [
                        {
                            model: Produto,
                            attributes: ['nomeProduto']
                        },
                        {
                            model: SubItemPedido,
                            as: 'subItensPedido',  // alias para subItensPedido
                            include: [
                                {
                                    model: SubProduto,
                                    attributes: ['nomeSubProduto']
                                }
                            ]
                        }
                    ]
                }]
            })
            console.log(pedidos)
            return pedidos
        } catch (error) {
            console.error(error)
            return { message: "Erro ao tentar encontrar pedidos", error }
        }
    }

    async countAllPedidos() {
        try {
            const pedidos = Pedido.count()
            return pedidos
        } catch (error) {
            return { message: "Erro ao tentar encontrar pedidos", error }
        }
    }

    // CORREÇÃO: Usando a função EXTRACT() do PostgreSQL
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
                raw: true // retorna objeto simples
            });

            const totalRevenue = parseFloat(result.totalRevenue) || 0;

            return { totalRevenue };
        } catch (error) {
            console.error(error);
            return { message: "Erro ao tentar calcular o rendimento mensal", error };
        }
    }

    // CORREÇÃO: Usando a função DATE_TRUNC, que é compatível com PostgreSQL
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

    // CORREÇÃO: Ajustando a consulta para a sintaxe correta com GROUP BY
    async getPaymentMethodDistribution() {
        try {
            const distribution = await FormaPagamento.findAll({
                attributes: [
                    'id',
                    'nomeFormaPagamento',
                    [Sequelize.fn('COUNT', Sequelize.col('pedidos.id')), 'count'] // alias correto
                ],
                include: [
                    {
                        model: Pedido,
                        as: 'pedidos', // garantir que bate com o relacionamento
                        attributes: []
                    }
                ],
                group: ['FormaPagamento.id', 'FormaPagamento.nomeFormaPagamento'],
                order: [['nomeFormaPagamento', 'ASC']]
            });


            // Formata para o frontend
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

    async findPedidoById(id) {
        try {
            const pedido = await Pedido.findByPk(id)
            return pedido
        } catch (error) {
            console.error(error)
            return { message: "Erro tentar encontrar o pedido", error }
        }
    }

    //funcao para encontrar pedido que estao vinculados a uma forma de pagamento
    async findPedidosByFormaPagamento(formaPagamento_id) {
        try {
            const pedidos = await Pedido.findAll({
                where: {
                    formaPagamento_id: formaPagamento_id
                }
            })
            return pedidos
        } catch (error) {
            console.error(error)
            return { message: "Erro ao tentar encontrar os pedidos", error }
        }
    }

    //funcao para atualizar pedido
    async updatePedido(updatedData, id) {
        try {
            const pedido = await Pedido.update(updatedData, {
                where: {
                    id: id
                }
            })
            return pedido
        } catch (error) {
            console.error(error)
            return { message: "Erro ao tentar atualizar um pedido", error }
        }
    }
}

export default new PedidoController()