// validators/pedidoValidator.js
import * as yup from 'yup';

// Valida cada opção escolhida (Ex: Arroz, Frango)
const opcaoItemPedidoSchema = yup.object({
    itemOpcaoId: yup.number()
        .required("O ID do item de opção é obrigatório.")
        .integer("O ID do item de opção deve ser um número inteiro.")
        .positive("O ID do item de opção deve ser um número positivo."),
    quantidade: yup.number()
        .required("A quantidade do item de opção é obrigatória.")
        .integer("A quantidade do item de opção deve ser um número inteiro.")
        .positive("A quantidade do item de opção deve ser no mínimo 1.")
});

// Valida cada produto principal (Ex: Marmita Média)
const produtoPedidoSchema = yup.object({
    produtoId: yup.number()
        .required("O ID do produto é obrigatório.")
        .integer("O ID do produto deve ser um número inteiro.")
        .positive("O ID do produto deve ser um número positivo."),
    quantidade: yup.number()
        .required("A quantidade do produto é obrigatória.")
        .integer("A quantidade deve ser um número inteiro.")
        .positive("A quantidade deve ser no mínimo 1."),
    // Valida o novo array de opções
    opcoesEscolhidas: yup.array().of(opcaoItemPedidoSchema).optional()
});

// Esquema principal para a criação de um novo pedido
export const createPedidoSchema = yup.object({
    formaPagamento_id: yup.number()
        .required("A forma de pagamento é obrigatória.")
        .integer("O ID da forma de pagamento deve ser um número inteiro.")
        .positive("O ID da forma de pagamento deve ser um número positivo."),

    isRetiradaEstabelecimento: yup.boolean().required("É necessário informar se o pedido é para retirada."),

    nomeCliente: yup.string().required("O nome do cliente é obrigatório."),
    telefoneCliente: yup.string().required("O telefone do cliente é obrigatório."), // Corrigido typo

    // --- Validação Condicional do Endereço ---
    // 'when' verifica o valor de 'isRetiradaEstabelecimento'
    cepCliente: yup.string().when('isRetiradaEstabelecimento', {
        is: false, // Se isRetiradaEstabelecimento for false (é entrega)
        then: schema => schema.required("O CEP é obrigatório para entrega."),
        otherwise: schema => schema.nullable()
    }),
    tipoLogadouroCliente: yup.string().when('isRetiradaEstabelecimento', {
        is: false,
        then: schema => schema.required("O tipo de logradouro é obrigatório para entrega."),
        otherwise: schema => schema.nullable()
    }),
    logadouroCliente: yup.string().when('isRetiradaEstabelecimento', {
        is: false,
        then: schema => schema.required("O logradouro é obrigatório para entrega."),
        otherwise: schema => schema.nullable()
    }),
    numeroCliente: yup.string().when('isRetiradaEstabelecimento', {
        is: false,
        then: schema => schema.required("O número é obrigatório para entrega."),
        otherwise: schema => schema.nullable()
    }),
    quadraCliente: yup.string().nullable(),
    loteCliente: yup.string().nullable(),
    bairroCliente: yup.string().when('isRetiradaEstabelecimento', {
        is: false,
        then: schema => schema.required("O bairro é obrigatório para entrega."),
        otherwise: schema => schema.nullable()
    }),
    cidadeCliente: yup.string().when('isRetiradaEstabelecimento', {
        is: false,
        then: schema => schema.required("A cidade é obrigatória para entrega."),
        otherwise: schema => schema.nullable()
    }),
    estadoCliente: yup.string().when('isRetiradaEstabelecimento', {
        is: false,
        then: schema => schema.length(2, "O estado (UF) é obrigatório para entrega."),
        otherwise: schema => schema.nullable()
    }),
    taxaEntrega: yup.number().min(0).default(0),

    // Validação do array de produtos usando o schema definido acima
    produtosPedido: yup.array().of(produtoPedidoSchema)
        .min(1, "O pedido deve conter pelo menos um item.")
        .required("A lista de produtos é obrigatória.")
});