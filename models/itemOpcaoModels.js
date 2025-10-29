import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";
import GrupoOpcao from "./grupoOpcaoModels.js";

const ItemOpcao = sequelize.define("itens_opcoes", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    nome: {
        type: DataTypes.STRING,
        allowNull: false // Ex: "Arroz", "Filé de Frango", "Banana Frita"
    },
    valorAdicional: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    isAtivo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    grupoOpcao_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: GrupoOpcao,
            key: "id"
        }
    }
},{
    tableName: "itens_opcoes",
    timestamps: true
});

export default ItemOpcao;