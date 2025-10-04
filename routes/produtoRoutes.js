import produtoController from '../controller/produtoController.js';
import express from 'express';
import cors from 'cors';
import { isAdmin, authenticateToken } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validationMiddleware.js';
import { createProdutoSchema, updateProdutoSchema } from '../validators/produtoValidator.js';

const produtoRoutes = express.Router();

// Usando o middleware do CORS para habilitar os recursos do domínio da página web
produtoRoutes.use(cors());

// Rota para criar um produto com subprodutos
produtoRoutes.post('/produto', authenticateToken, isAdmin, validate(createProdutoSchema), async (req, res) => {
    const { nomeProduto, valorProduto, image, isAtivo, categoriaProduto_id, subprodutos } = req.body;

    try {
        const produto = await produtoController.createProduto(nomeProduto, valorProduto, image, isAtivo, categoriaProduto_id, subprodutos);
        return res.status(200).json(produto);
    } catch (error) {
        console.error(error);
        return res.status(400).send(error);
    }
});

// Rota para encontrar todos os produtos com subprodutos
produtoRoutes.get('/produto', async (req, res) => {
    try {
        const produtos = await produtoController.findAndCountAllProdutos();
        return res.status(200).json(produtos);
    } catch (error) {
        console.error(error);
        return res.status(400).send(error);
    }
});

// Rota para encontrar um produto pelo id, incluindo os subprodutos
produtoRoutes.get('/produto/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const produto = await produtoController.findProduto(id);
        return res.status(200).json(produto);
    } catch (error) {
        console.error(error);
        return res.status(400).send(error);
    }
});

// Rota para atualizar um produto, incluindo os subprodutos
produtoRoutes.put('/produto/:id', authenticateToken, isAdmin, validate(updateProdutoSchema), async (req, res) => {
    const { id } = req.params;
    const { nomeProduto, valorProduto, image, isAtivo, categoriaProduto_id, subprodutos } = req.body;

    try {
        const produto = await produtoController.updateProduto(id, { nomeProduto, valorProduto, image, isAtivo, categoriaProduto_id, subprodutos });
        return res.status(200).json(produto);
    } catch (error) {
        console.error(error);
        return res.status(400).send(error);
    }
});

// Rota para deletar um produto (e seus subprodutos)
produtoRoutes.delete('/produto/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const produto = await produtoController.deleteProduto(id);
        return res.status(200).json(produto);
    } catch (error) {
        console.error(error);
        return res.status(400).send(error);
    }
});

// Rota para ativar ou desativar um produto (e seus subprodutos, se necessário)
produtoRoutes.put('/produto/:id/toggle', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const produto = await produtoController.toggleProdutoAtivo(id);
        return res.status(200).json(produto);
    } catch (error) {
        console.error(error);
        return res.status(400).send(error);
    }
});

export default produtoRoutes;
