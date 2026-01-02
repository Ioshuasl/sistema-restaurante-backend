// validators/pedidoValidator.js
import * as yup from 'yup';

export const createPedidoSchema = yup.object({
    formaPagamento_id: yup.number()
        .required("A forma de pagamento é obrigatória.")
        .integer()
        .positive(),
    isRetiradaEstabelecimento: yup.boolean().required("É necessário informar se é para retirada."),
    
    // Adicionado validação para a situação do pedido
    situacaoPedido: yup.string()
        .oneOf(['preparando', 'entrega', 'finalizado', 'cancelado'], "Situação do pedido inválida.")
        .required("A situação do pedido é obrigatória."),

    nomeCliente: yup.string().required("O nome do cliente é obrigatório."),
    telefoneCliente: yup.string().required("O telefone do cliente é obrigatório."), // Corrigido o nome do campo
    
    cepCliente: yup.string().required("O CEP é obrigatório."),
    logadouroCliente: yup.string().required("O logradouro é obrigatório."),
    numeroCliente: yup.string().required("O número é obrigatório."),
    bairroCliente: yup.string().required("O bairro é obrigatório."),
    cidadeCliente: yup.string().required("A cidade é obrigatória."),
    estadoCliente: yup.string().length(2, "Use a sigla UF (ex: SP).").required("O estado é obrigatório."),

    observacao: yup.string().nullable(),

    produtosPedido: yup.array().of(
        yup.object({
            produtoId: yup.number().required().integer().positive(),
            quantidade: yup.number().required().integer().positive(),
            observacaoItem: yup.string().nullable()
        })
    ).min(1, "O pedido deve conter pelo menos um item.").required()
});