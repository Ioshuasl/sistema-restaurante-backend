import * as yup from 'yup';

// Esquema para validar SubProduto dentro de Produto
const subProdutoSchema = yup.object({
    id: yup.number().integer().optional(), // no update pode vir id
    nomeSubProduto: yup.string().required("O nome do subproduto é obrigatório.").min(2),
    isAtivo: yup.boolean().default(true)
});

// Esquema para criar um produto
export const createProdutoSchema = yup.object({
    nomeProduto: yup.string().required("O nome do produto é obrigatório.").min(3),
    valorProduto: yup.number().required("O valor é obrigatório.").positive(),
    image: yup.string().required("A imagem do produto é obrigatória."),
    isAtivo: yup.boolean().default(true),
    categoriaProduto_id: yup.number().required("A categoria é obrigatória.").integer(),
    subprodutos: yup.array().of(subProdutoSchema).optional() // pode vir vazio ou não vir
});

// Esquema para atualizar um produto
export const updateProdutoSchema = yup.object({
    nomeProduto: yup.string().min(3),
    valorProduto: yup.number().positive(),
    image: yup.string(),
    isAtivo: yup.boolean(),
    categoriaProduto_id: yup.number().integer(),
    subprodutos: yup.array().of(subProdutoSchema).optional()
});
