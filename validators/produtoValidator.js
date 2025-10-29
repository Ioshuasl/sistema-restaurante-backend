import * as yup from 'yup';

// Esquema para validar os Itens (Arroz, Frango, etc.) dentro de um Grupo
const itemOpcaoSchema = yup.object({
    id: yup.number().integer().optional(), // no update pode vir id
    nome: yup.string().required("O nome do item é obrigatório.").min(2),
    valorAdicional: yup.number().default(0).min(0, "O valor adicional não pode ser negativo."),
    isAtivo: yup.boolean().default(true)
});

// Esquema para validar os Grupos (Bases, Carnes, etc.)
const grupoOpcaoSchema = yup.object({
    id: yup.number().integer().optional(), // no update pode vir id
    nome: yup.string().required("O nome do grupo é obrigatório.").min(3),
    minEscolhas: yup.number().integer("Mínimo de escolhas deve ser um número.")
                     .required("O mínimo de escolhas é obrigatório.")
                     .min(0, "Mínimo de escolhas não pode ser negativo."),
    maxEscolhas: yup.number().integer("Máximo de escolhas deve ser um número.")
                     .required("O máximo de escolhas é obrigatório.")
                     .min(1, "Máximo de escolhas deve ser ao menos 1.")
                     .test(
                         'is-greater-than-min',
                         'Máximo de escolhas deve ser maior ou igual ao mínimo.',
                         function (value) {
                             const { minEscolhas } = this.parent;
                             return value >= minEscolhas;
                         }
                     ),
    itens: yup.array().of(itemOpcaoSchema).optional() // O grupo pode ter itens
});

// Esquema para criar um produto
export const createProdutoSchema = yup.object({
    nomeProduto: yup.string().required("O nome do produto é obrigatório.").min(3),
    valorProduto: yup.number().required("O valor é obrigatório.").positive(),
    image: yup.string().required("A imagem do produto é obrigatória."),
    isAtivo: yup.boolean().default(true),
    categoriaProduto_id: yup.number().required("A categoria é obrigatória.").integer(),
    grupos: yup.array().of(grupoOpcaoSchema).optional() 
});

// Esquema para atualizar um produto
export const updateProdutoSchema = yup.object({
    nomeProduto: yup.string().min(3).optional(),
    valorProduto: yup.number().positive().optional(),
    image: yup.string().optional(),
    isAtivo: yup.boolean().optional(),
    categoriaProduto_id: yup.number().integer().optional(),
    // Substituído 'subprodutos' por 'grupos'
    // Tornamos os campos internos opcionais também para permitir updates parciais
    grupos: yup.array().of(
        grupoOpcaoSchema.shape({
            nome: yup.string().min(3).optional(),
            minEscolhas: yup.number().integer().min(0).optional(),
            maxEscolhas: yup.number().integer().min(1).optional(),
            itens: yup.array().of(
                itemOpcaoSchema.shape({
                    nome: yup.string().min(2).optional(),
                    valorAdicional: yup.number().min(0).optional(),
                    isAtivo: yup.boolean().optional()
                })
            ).optional()
        })
    ).optional()
});