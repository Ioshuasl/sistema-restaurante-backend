// controller/menuController.js
import CategoriaProduto from "../models/categoriaProdutoModels.js"
import Produto from "../models/produtoModels.js"
// 1. Removemos SubProduto e importamos os novos models
import GrupoOpcao from "../models/grupoOpcaoModels.js";
import ItemOpcao from "../models/itemOpcaoModels.js";

// 2. Definimos TODAS as associações aqui para garantir
Produto.belongsTo(CategoriaProduto, { foreignKey: 'categoriaProduto_id'});
CategoriaProduto.hasMany(Produto, { foreignKey: 'categoriaProduto_id' });

Produto.hasMany(GrupoOpcao, { foreignKey: "produto_id", onDelete: "CASCADE" });
GrupoOpcao.belongsTo(Produto, { foreignKey: "produto_id" });

GrupoOpcao.hasMany(ItemOpcao, { foreignKey: "grupoOpcao_id", onDelete: "CASCADE" });
ItemOpcao.belongsTo(GrupoOpcao, { foreignKey: "grupoOpcao_id" });


class MenuController{
    //funcao para montar o menu do cardápio com as categorias de produtos e os produtos
    async getMenu() {
        try {
            const categoriaProdutos = await CategoriaProduto.findAll({
                include: {
                    model: Produto,
                    where: {
                        isAtivo: true // Apenas produtos ativos
                    },
                    required: true, // Garante que categorias sem produtos ativos não apareçam
                    // 3. Atualizamos a inclusão para a nova estrutura
                    include: {
                        model: GrupoOpcao, // Inclui os Grupos (Bases, Carnes...)
                        required: false, // Produtos podem não ter grupos
                        include: {
                            model: ItemOpcao, // Inclui os Itens (Arroz, Frango...)
                            where: {
                                isAtivo: true // Apenas itens ativos
                            },
                            required: false // Grupos podem não ter itens
                        }
                    }
                },
                order: [
                    // Ordena as categorias, produtos, grupos e itens
                    ['id', 'ASC'],
                    [Produto, 'id', 'ASC'],
                    [Produto, GrupoOpcao, 'id', 'ASC'],
                    [Produto, GrupoOpcao, ItemOpcao, 'id', 'ASC']
                ]
            })
            return categoriaProdutos
        } catch (error) {
            console.error(error)
            return { message: "Erro ao tentar executar a função", error }
        }
    }
}

export default new MenuController()