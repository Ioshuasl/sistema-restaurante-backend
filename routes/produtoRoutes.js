// routes/produtoRoutes.js
import produtoController from '../controller/produtoController.js';
import express from 'express';
import cors from 'cors';
import { isAdmin, authenticateToken } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validationMiddleware.js';
import { createProdutoSchema, updateProdutoSchema } from '../validators/produtoValidator.js';

const produtoRoutes = express.Router();

produtoRoutes.use(cors());

// Rota para criar um produto (com grupos e itens)
produtoRoutes.post('/produto', authenticateToken, isAdmin, validate(createProdutoSchema), async (req, res) => {
    try {
        // 1. Passa o req.body inteiro. O controller agora espera um objeto 'data'.
        const produto = await produtoController.createProduto(req.body);
        return res.status(200).json(produto);
    } catch (error) {
        console.error(error);
        // Não vaze o erro detalhado para o cliente
        return res.status(500).json({ message: "Erro ao criar produto." });
    }
});

// Rota para encontrar todos os produtos
produtoRoutes.get('/produto', async (req, res) => {
    try {
        const produtos = await produtoController.findAndCountAllProdutos();
        return res.status(200).json(produtos);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao buscar produtos." });
    }
});

// Rota para encontrar um produto pelo id
produtoRoutes.get('/produto/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const produto = await produtoController.findProduto(id);
        if (!produto) {
            return res.status(404).json({ message: "Produto não encontrado." });
        }
        return res.status(200).json(produto);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao buscar produto." });
    }
});

// Rota para atualizar um produto
produtoRoutes.put('/produto/:id', authenticateToken, isAdmin, validate(updateProdutoSchema), async (req, res) => {
    const { id } = req.params;
    try {
        // 2. Passa o req.body inteiro. O controller espera 'dataUpdate'.
        const resultado = await produtoController.updateProduto(id, req.body);
        if (resultado.produto) {
            return res.status(200).json(resultado.produto);
        } else {
            return res.status(404).json({ message: resultado.message });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao atualizar produto." });
    }
});

// Rota para deletar um produto
produtoRoutes.delete('/produto/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const resultado = await produtoController.deleteProduto(id);
        if (resultado.produto) {
            return res.status(200).json({ message: resultado.message });
        } else {
            return res.status(404).json({ message: resultado.message });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao deletar produto." });
    }
});

// Rota para ativar ou desativar um produto
produtoRoutes.put('/produto/:id/toggle', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const produto = await produtoController.toggleProdutoAtivo(id);
        if (!produto.message) {
            return res.status(200).json(produto);
        } else {
            return res.status(404).json({ message: produto.message });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao alternar status do produto." });
    }
});

export default produtoRoutes;