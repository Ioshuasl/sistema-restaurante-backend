import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import ItemPedido from './itemPedidoModels.js';
import ItemOpcao from './itemOpcaoModels.js'; 

const OpcaoItemPedido = sequelize.define('opcao_item_pedido', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    itemPedidoId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: ItemPedido, // Referencia o ItemPedido
            key: 'id'
        }
    },
    itemOpcaoId: { // <-- MUDANÇA PRINCIPAL
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: ItemOpcao, // Referencia o novo model ItemOpcao
            key: 'id'
        }
    },
    quantidade: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    precoAdicional: { // Preço do ItemOpcao no momento da compra
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
    }
}, {
    tableName: 'opcao_item_pedido',
    timestamps: false
});

export default OpcaoItemPedido;