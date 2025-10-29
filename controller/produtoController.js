import Produto from "../models/produtoModels.js";
import CategoriaProduto from "../models/categoriaProdutoModels.js";
import fs from 'fs/promises';
import path from 'path';
import { Sequelize, Op } from 'sequelize';
import GrupoOpcao from "../models/grupoOpcaoModels.js";
import ItemOpcao from "../models/itemOpcaoModels.js";


// Categoria <-> Produto (Já existente)
Produto.belongsTo(CategoriaProduto, { foreignKey: 'categoriaProduto_id' });
CategoriaProduto.hasMany(Produto, { foreignKey: 'categoriaProduto_id' });

// Produto <-> GrupoOpcao (NOVA)
// Um Produto (Marmita) tem vários Grupos (Bases, Carnes)
Produto.hasMany(GrupoOpcao, { foreignKey: "produto_id", onDelete: "CASCADE" });
GrupoOpcao.belongsTo(Produto, { foreignKey: "produto_id" });

// GrupoOpcao <-> ItemOpcao (NOVA)
// Um Grupo (Carnes) tem vários Itens (Frango, Vaca, Porco)
GrupoOpcao.hasMany(ItemOpcao, { foreignKey: "grupoOpcao_id", onDelete: "CASCADE" });
ItemOpcao.belongsTo(GrupoOpcao, { foreignKey: "grupoOpcao_id" });

// Pegando a instância do sequelize a partir de um model
const sequelize = Produto.sequelize;

class ProdutoController {

    // Funcao para criar produto com seus grupos e itens
    async createProduto(data) {
        // 'data' deve conter: { nomeProduto, valorProduto, ..., grupos: [...] }
        // onde 'grupos' é um array: [{ nome, minEscolhas, maxEscolhas, itens: [...] }]
        // e 'itens' é um array: [{ nome, valorAdicional, isAtivo }]
        
        const { grupos = [], ...dadosProduto } = data;
        const t = await sequelize.transaction(); // Inicia a transação

        try {
            // 1. Verificar se a categoria existe
            const verificarCategoriaProduto = await CategoriaProduto.findByPk(dadosProduto.categoriaProduto_id);
            if (!verificarCategoriaProduto) {
                throw new Error("Categoria de produto não encontrada.");
            }

            // 2. Criar o produto
            const produto = await Produto.create(dadosProduto, { transaction: t });

            // 3. Criar os Grupos e seus Itens
            if (grupos.length > 0) {
                // Usamos Promise.all para esperar todos os grupos serem criados
                await Promise.all(grupos.map(async (grupoData) => {
                    const { itens = [], ...dadosGrupo } = grupoData;

                    // Cria o Grupo
                    const grupo = await GrupoOpcao.create({
                        ...dadosGrupo,
                        produto_id: produto.id
                    }, { transaction: t });

                    // Cria os Itens para este Grupo
                    if (itens.length > 0) {
                        const itensParaCriar = itens.map(itemData => ({
                            ...itemData,
                            grupoOpcao_id: grupo.id
                        }));
                        await ItemOpcao.bulkCreate(itensParaCriar, { transaction: t });
                    }
                }));
            }

            // 4. Se tudo deu certo, 'commita' a transação
            await t.commit();

            // 5. Retornar produto completo com os grupos e itens
            const produtoCompleto = await Produto.findByPk(produto.id, {
                include: [{
                    model: GrupoOpcao,
                    include: [{
                        model: ItemOpcao
                    }]
                }]
            });

            return produtoCompleto;

        } catch (error) {
            // 6. Se algo deu errado, 'rollback' desfaz tudo
            await t.rollback();
            console.error(error);
            return { message: "Erro ao tentar criar o produto", error: error.message };
        }
    }

    // Funcao para encontrar todos os produtos (com grupos e itens)
    async findAndCountAllProdutos() {
        try {
            const produtos = await Produto.findAndCountAll({
                include: [{
                    model: GrupoOpcao,
                    include: [{
                        model: ItemOpcao
                    }]
                }]
            });
            return produtos;
        } catch (error) {
            console.error(error);
            return { message: "Erro ao tentar executar a função", error };
        }
    }

    // Funcao para encontrar produto por ID (com grupos e itens)
    async findProduto(id) {
        try {
            const produto = await Produto.findByPk(id, {
                include: [{
                    model: GrupoOpcao,
                    include: [{
                        model: ItemOpcao
                    }]
                }]
            });
            return produto;
        } catch (error) {
            console.error(error);
            return { message: "Erro ao tentar executar a função", error };
        }
    }

    // Funcao para atualizar produto (com grupos e itens)
    async updateProduto(id, dataUpdate) {
        const { grupos = [], ...dadosProduto } = dataUpdate;
        const t = await sequelize.transaction();

        try {
            const produtoAtual = await Produto.findByPk(id);
            if (!produtoAtual) {
                throw new Error("Produto não encontrado");
            }

            const imagemAntiga = produtoAtual.image;

            // 1. Atualizar dados do produto (ex: nome, valor)
            await Produto.update(dadosProduto, { where: { id }, transaction: t });

            // 2. Lidar com a imagem antiga (lógica que você já tinha)
            if (dadosProduto.image && dadosProduto.image !== imagemAntiga) {
                const nomeArquivoAntigo = path.basename(imagemAntiga);
                const caminhoArquivoAntigo = path.join(process.cwd(), 'public', 'uploads', nomeArquivoAntigo);
                try {
                    await fs.access(caminhoArquivoAntigo);
                    await fs.unlink(caminhoArquivoAntigo);
                } catch (err) {
                    console.error(`Erro ao excluir imagem antiga:`, err);
                }
            }

            // 3. Atualizar Grupos e Itens (Estratégia: Deletar todos e Recriar)
            // É a forma mais simples e segura de garantir consistência
            
            // Deleta todos os grupos (e seus itens, via CASCADE)
            await GrupoOpcao.destroy({
                where: { produto_id: id },
                transaction: t
            });

            // Recria os Grupos e seus Itens (mesma lógica do createProduto)
            if (grupos.length > 0) {
                await Promise.all(grupos.map(async (grupoData) => {
                    const { itens = [], ...dadosGrupo } = grupoData;

                    const grupo = await GrupoOpcao.create({
                        ...dadosGrupo,
                        produto_id: id // Usa o ID do produto que estamos atualizando
                    }, { transaction: t });

                    if (itens.length > 0) {
                        const itensParaCriar = itens.map(itemData => ({
                            ...itemData,
                            grupoOpcao_id: grupo.id
                        }));
                        await ItemOpcao.bulkCreate(itensParaCriar, { transaction: t });
                    }
                }));
            }

            // 4. Commit da transação
            await t.commit();

            // 5. Retornar produto atualizado
            const produtoAtualizado = await this.findProduto(id);
            return { message: "Produto atualizado com sucesso", produto: produtoAtualizado };

        } catch (error) {
            await t.rollback();
            console.error(error);
            return { message: "Erro ao tentar atualizar o produto", error: error.message };
        }
    }

    // Funcao para excluir produto
    async deleteProduto(id) {
        // Graças ao 'onDelete: "CASCADE"' nas associações,
        // deletar o produto irá deletar automaticamente
        // todos os seus Grupos e Itens.

        try {
            const produtoParaDeletar = await Produto.findByPk(id);
            if (!produtoParaDeletar) {
                return { message: "Produto não encontrado.", produto: null };
            }

            const imagemParaDeletar = produtoParaDeletar.image;

            // 1. Excluir o produto (o CASCADE cuidará dos grupos/itens)
            await produtoParaDeletar.destroy();

            // 2. Excluir a imagem do servidor
            if (imagemParaDeletar) {
                const nomeArquivo = path.basename(imagemParaDeletar);
                const caminhoArquivo = path.join(process.cwd(), 'public', 'uploads', nomeArquivo);
                try {
                    await fs.access(caminhoArquivo);
                    await fs.unlink(caminhoArquivo);
                } catch (err) {
                    console.error(`Erro ao excluir imagem:`, err);
                }
            }

            return { message: "Produto e seus grupos/itens excluídos com sucesso", produto: produtoParaDeletar };

        } catch (error) {
            console.error(error);
            return { message: "Erro ao tentar executar a função", error };
        }
    }
    
    // A função toggleProdutoAtivo pode continuar exatamente como estava
    async toggleProdutoAtivo(id) {
        const produto = await Produto.findByPk(id)
        if (!produto) {
            return { message: "Produto nao encontrado no sistema" }
        }
        try {
            produto.isAtivo = !produto.isAtivo
            await produto.save()
            return produto
        } catch (error) {
            return { message: "Erro ao tentar modificar produto", error }
        }
    }
}

export default new ProdutoController();