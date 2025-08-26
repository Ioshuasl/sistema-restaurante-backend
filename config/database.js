import { Sequelize } from "sequelize";

const sequelize = new Sequelize('sistema-restaurante', 'ioshua', '81ioshua29', {
    host: 'easypanel.ioshuavps.com.br',
    dialect: 'postgres',
    port: 2777
});

export default sequelize;