import CategoriaProduto from "../models/categoriaProdutoModels.js"
import Produto from "../models/produtoModels.js"
// 1. Importar os novos models
import GrupoOpcao from "../models/grupoOpcaoModels.js"
import ItemOpcao from "../models/itemOpcaoModels.js"

// 2. Definir as associações corretas
Produto.belongsTo(CategoriaProduto, { foreignKey: 'categoriaProduto_id' });
CategoriaProduto.hasMany(Produto, { foreignKey: 'categoriaProduto_id' });

Produto.hasMany(GrupoOpcao, { foreignKey: "produto_id", onDelete: "CASCADE" });
GrupoOpcao.belongsTo(Produto, { foreignKey: "produto_id" });

GrupoOpcao.hasMany(ItemOpcao, { foreignKey: "grupoOpcao_id", onDelete: "CASCADE" });
ItemOpcao.belongsTo(GrupoOpcao, { foreignKey: "grupoOpcao_id" });

class CategoriaProdutoController {

    //funcao para criar categoria de produto
    async createCategoriaProduto(nomeCategoriaProduto) {
        console.log(nomeCategoriaProduto)
        try {
            const categoriaProduto = await CategoriaProduto.create({ nomeCategoriaProduto })
            return { message: "Categoria de produto criado com sucesso", categoriaProduto }
        } catch (error) {
            console.error(error)
            return { message: "Erro ao tentar executar a função", error }
        }
    }

    //funcao para encontrar todas as categorias de produto cadastrado na aplicacao
    async findAllCategoriaProdutos() {
        try {
            const categoriaProdutos = await CategoriaProduto.findAll({
                include: [{
                    model: Produto,          
                    // 3. Atualizar a inclusão para a nova estrutura aninhada
                    include: [{
                        model: GrupoOpcao,
                        include: [{
                            model: ItemOpcao
                        }]
                    }]
                }]
            })
            return categoriaProdutos
        } catch (error) {
            console.error(error)
            return { message: "Erro ao tentar executar a função", error }
        }
    }

    //funcao para encontrar categoria de produto a partir do ID
    async findCategoriaProduto(id) {
        try {
            const categoriaProduto = await CategoriaProduto.findByPk(id)
            return categoriaProduto
        } catch (error) {
            console.error(error)
            return error
        }
    }

    //funcao para atualizar categoria de produto
    async updateCategoriaProduto(id, updatedata) {
        try {
            const categoriaProduto = await CategoriaProduto.update(updatedata, {
                where: { id: id }
            })
            return { message: "Categoria de produto atualizado com sucesso", categoriaProduto }
        } catch (error) {
            console.error(error)
            return { message: "Erro ao tentar executar a função", error }
        }
    }

    //funcao para deletar categoria de produto
    async deleteCategoriaProduto(id) {
        try {
            const categoriaProduto = await CategoriaProduto.destroy({
                where: { id: id }
            })
            return { message: "Categoria de produto excluído com sucesso", categoriaProduto }
        } catch (error) {
            console.error(error)
            return { message: "Erro ao tentar executar a função", error }
        }
    }
}

export default new CategoriaProdutoController()