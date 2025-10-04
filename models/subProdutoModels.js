import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";
import Produto from "./produtoModels.js";

const SubProduto = sequelize.define("subprodutos", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    nomeSubProduto: {
        type: DataTypes.STRING,
        allowNull: false
    },
    isAtivo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    valorAdicional: { // opcional, caso algum subproduto tenha custo extra
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    produto_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Produto,
            key: "id"
        }
    }
},{
    tableName: "subprodutos",
    timestamps: true
});

export default SubProduto;
