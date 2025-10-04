import Produto from "../models/produtoModels.js"
import CategoriaProduto from "../models/categoriaProdutoModels.js"
import fs from 'fs/promises';
import path from 'path';
import SubProduto from "../models/subProdutoModels.js";
import { Sequelize, Op, fn, col, where, literal } from 'sequelize';

Produto.belongsTo(CategoriaProduto, { foreignKey: 'categoriaProduto_id' })
CategoriaProduto.hasMany(Produto, { foreignKey: 'categoriaProduto_id' })

Produto.hasMany(SubProduto, { foreignKey: "produto_id", onDelete: "CASCADE" });
SubProduto.belongsTo(Produto, { foreignKey: "produto_id" });

class ProdutoController {

    //funcao para criar produto
    async createProduto(nomeProduto, valorProduto, image, isAtivo, categoriaProduto_id, subprodutos = []) {
        try {
            // 1. Verificar se a categoria existe
            const verificarCategoriaProduto = await CategoriaProduto.findByPk(categoriaProduto_id);
            if (!verificarCategoriaProduto) {
                return { message: "Categoria de produto não encontrada." };
            }

            // 2. Criar o produto
            const produto = await Produto.create({
                nomeProduto,
                valorProduto,
                image,
                isAtivo,
                categoriaProduto_id
            });

            // 3. Criar os subprodutos vinculados, se existirem
            if (subprodutos.length > 0) {
                const subprodutosComProdutoId = subprodutos.map(sp => ({
                    ...sp,
                    produto_id: produto.id
                }));

                await SubProduto.bulkCreate(subprodutosComProdutoId);
            }

            // 4. Retornar produto com os subprodutos
            const produtoComSubprodutos = await Produto.findByPk(produto.id, {
                include: [{ model: SubProduto, as: "subprodutos" }]
            });

            return produtoComSubprodutos;
        } catch (error) {
            console.error(error);
            return { message: "Erro ao tentar executar a função", error };
        }
    }

    //funcao para encontrar todos os produtos cadastrados no sistema
    async findAndCountAllProdutos() {
        try {
            const produtos = await Produto.findAndCountAll({
                include: [SubProduto]
            })
            return produtos
        } catch (error) {
            console.error(error)
            return { message: "Erro ao tentar executar a função", error }
        }
    }

    //funcao para encontrar todos os produtos que estiverem ativos no sistema
    async findAllProdutosAtivos() {
        try {
            const produtos = await Produto.findAll({
                where: {
                    isAtivo: true
                },
                include: [SubProduto]
            })
            return produtos
        } catch (error) {
            console.error(error)
            return { message: "Erro ao tentar encontrar apenas os produtos ativos", error }
        }
    }

    //funcao para encontrar produto por ID
    async findProduto(id) {
        try {
            const produto = await Produto.findByPk(id, {
                include: [SubProduto]
            })
            return produto
        } catch (error) {
            console.error(error)
            return { message: "Erro ao tentar executar a função", error }
        }
    }

    //funcao para atualizar produto
    async updateProduto(id, dataUpdate) {
        try {
            // 1. Encontrar o produto atual
            const produtoAtual = await Produto.findByPk(id, {
                include: [{ model: SubProduto, as: "subprodutos" }]
            });

            if (!produtoAtual) {
                return { message: "Produto não encontrado", produto: null };
            }

            // 2. Guardar a imagem antiga antes de atualizar
            const imagemAntiga = produtoAtual.image;

            // 3. Atualizar dados do produto (sem os subprodutos ainda)
            const { subprodutos, ...dadosProduto } = dataUpdate;

            await Produto.update(dadosProduto, { where: { id } });

            // 4. Se imagem foi alterada, excluir a antiga
            if (dadosProduto.image && dadosProduto.image !== imagemAntiga) {
                const nomeArquivoAntigo = path.basename(imagemAntiga);
                const caminhoArquivoAntigo = path.join(process.cwd(), 'public', 'uploads', nomeArquivoAntigo);

                try {
                    await fs.access(caminhoArquivoAntigo);
                    await fs.unlink(caminhoArquivoAntigo);
                    console.log(`Imagem antiga ${nomeArquivoAntigo} excluída com sucesso.`);
                } catch (err) {
                    console.error(`Erro ao excluir imagem antiga ${nomeArquivoAntigo}:`, err);
                }
            }

            // 5. Atualizar os subprodutos se vieram no update
            if (subprodutos && Array.isArray(subprodutos)) {
                const subprodutosIds = subprodutos.map(sp => sp.id).filter(Boolean);

                // Excluir subprodutos que não estão mais no array enviado
                await SubProduto.destroy({
                    where: {
                        produto_id: id,
                        id: { [Sequelize.Op.notIn]: subprodutosIds }
                    }
                });

                // Atualizar ou criar subprodutos
                for (const sp of subprodutos) {
                    if (sp.id) {
                        // Já existe -> atualizar
                        await SubProduto.update(
                            {
                                nomeSubProduto: sp.nomeSubProduto,
                                isAtivo: sp.isAtivo,
                                valorAdicional: sp.valorAdicional
                            },
                            { where: { id: sp.id, produto_id: id } }
                        );
                    } else {
                        // Novo -> criar
                        await SubProduto.create({
                            nomeSubProduto: sp.nomeSubProduto,
                            isAtivo: sp.isAtivo,
                            valorAdicional: sp.valorAdicional,
                            produto_id: id
                        });
                    }
                }
            }

            // 6. Retornar produto atualizado com subprodutos
            const produtoAtualizado = await Produto.findByPk(id, {
                include: [{ model: SubProduto, as: "subprodutos" }]
            });

            return { message: "Produto atualizado com sucesso", produto: produtoAtualizado };
        } catch (error) {
            console.error(error);
            return { message: "Erro ao tentar executar a função", error };
        }
    }

    //funcao para excluir produto
    async deleteProduto(id) {
        try {
            // 1. Buscar produto para validação e imagem
            const produtoParaDeletar = await Produto.findByPk(id);

            if (!produtoParaDeletar) {
                return { message: "Produto não encontrado.", produto: null };
            }

            const imagemParaDeletar = produtoParaDeletar.image;

            // 2. Excluir todos os subprodutos vinculados (explicitamente)
            await SubProduto.destroy({
                where: { produto_id: id }
            });

            // 3. Excluir o produto
            await produtoParaDeletar.destroy(); // usa a instância para acionar hooks e cascata corretamente

            // 4. Excluir a imagem do servidor (se existir)
            if (imagemParaDeletar) {
                const nomeArquivo = path.basename(imagemParaDeletar);
                const caminhoArquivo = path.join(process.cwd(), 'public', 'uploads', nomeArquivo);

                try {
                    await fs.access(caminhoArquivo);
                    await fs.unlink(caminhoArquivo);
                    console.log(`Imagem ${nomeArquivo} excluída com sucesso.`);
                } catch (err) {
                    console.error(`Erro ao excluir imagem ${nomeArquivo}:`, err);
                }
            }

            return { message: "Produto e subprodutos excluídos com sucesso", produto: produtoParaDeletar };

        } catch (error) {
            console.error(error);
            return { message: "Erro ao tentar executar a função", error };
        }
    }


    //funcao para ativar ou desativar produto do sistema
    async toggleProdutoAtivo(id) {

        const produto = await Produto.findByPk(id)

        //verificando se o produto foi encontrado antes de fazer as alteracoes
        if (produto) {
            console.log("Produto encontrado, continua a funcao")
        } else {
            return { message: "Produto nao encontrado no sistema" }
        }

        try {
            //alternando o boolean do produto
            produto.isAtivo = !produto.isAtivo
            //salvando as alteracoes
            await produto.save()
            return produto
        } catch (error) {
            return { message: "Erro ao tentar modificar produto", error }
        }
    }
}

export default new ProdutoController()