import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";
import Produto from "./produtoModels.js";

const GrupoOpcao = sequelize.define("grupos_opcoes", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    nome: {
        type: DataTypes.STRING,
        allowNull: false // Ex: "Bases", "Carnes", "Acompanhamentos"
    },
    minEscolhas: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0 // Regra: Mínimo de itens que o cliente pode escolher
    },
    maxEscolhas: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1 // Regra: Máximo de itens que o cliente pode escolher
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
    tableName: "grupos_opcoes",
    timestamps: true
});

export default GrupoOpcao;