import { Config } from "../models/index.js";

class ConfigController {

    // Função para encontrar ou criar a configuração/parâmetros do sistema
    async getOrCreateConfig(id) {
        try {
            const [config, created] = await Config.findOrCreate({
                where: { id: id },
                defaults: {
                    cnpj: '00000000000000',
                    razaoSocial: 'NOME DA SUA EMPRESA',
                    nomeFantasia: 'NOME FANTASIA',
                    cep: '00000000',
                    tipoLogadouro: 'Rua',
                    logadouro: 'Endereço Principal',
                    numero: 'S/N',
                    quadra: 'N/A',
                    lote: 'N/A',
                    bairro: 'Centro',
                    cidade: 'Sua Cidade',
                    estado: 'UF',
                    telefone: '00000000000',
                    email: 'contato@suaempresa.com',
                    taxaEntrega: 0.00,
                    evolutionInstanceName: 'Nome da sua Instancia da Evolution Api',
                    urlAgenteImpressao: "http://localhost:4000",
                    nomeImpressora: "Microsoft Print to PDF",
                    menuLayout: 'modern',
                }
            });

            if (created) {
                console.log("Registro de configuração inicial criado com sucesso");
            }

            return config;

        } catch (error) {
            console.error(error);
            return error;
        }
    }

    // Função para atualizar configuração do sistema/parâmetros
    async updateConfig(id, updatedData) {
        try {
            const config = await Config.findByPk(id);

            if (!config) {
                throw new Error("Registro de configuração não encontrado através do id.");
            }

            const updatedConfig = await config.update(updatedData);

            return updatedConfig;

        } catch (error) {
            console.error(error);
            return error;
        }
    }

}

export default new ConfigController();
