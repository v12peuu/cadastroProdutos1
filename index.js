const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Conectado ao banco de dados SQLite.');
});

db.run(`CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    preco REAL NOT NULL,
    quantidade INTEGER NOT NULL DEFAULT 0
)`);

let carrinho = [];

app.post('/produtos', (req, res) => {
    const { nome, preco, quantidade } = req.body;
    const sql = 'INSERT INTO produtos (nome, preco, quantidade) VALUES (?, ?, ?)';
    db.run(sql, [nome, preco, quantidade], function(err) {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID, nome, preco, quantidade });
    });
});

app.get('/produtos', (req, res) => {
    const { order, quantidade } = req.query;
    let sql = 'SELECT * FROM produtos';
    const params = [];

    if (quantidade) {
        sql += ' WHERE quantidade >= ?';
        params.push(quantidade);
    }

    if (order === 'asc') {
        sql += ' ORDER BY preco ASC';
    } else if (order === 'desc') {
        sql += ' ORDER BY preco DESC';
    }

    db.all(sql, params, (err, rows) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.get('/produtos/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT * FROM produtos WHERE id = ?';

    db.get(sql, id, (err, row) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ message: 'Produto não encontrado' });
        }
        res.json(row);
    });
});

app.get('/produtos/baixo-estoque', (req, res) => {
    const sql = 'SELECT * FROM produtos WHERE quantidade < 10';

    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.post('/carrinho', (req, res) => {
    const { produto_id, quantidade } = req.body;

    db.get('SELECT * FROM produtos WHERE id = ?', [produto_id], (err, produto) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        if (!produto) {
            return res.status(404).json({ message: 'Produto não encontrado' });
        }
        if (quantidade > produto.quantidade) {
            return res.status(400).json({ message: 'Quantidade solicitada maior que a disponível em estoque.' });
        }

        const novaQuantidade = produto.quantidade - quantidade;
        db.run('UPDATE produtos SET quantidade = ? WHERE id = ?', [novaQuantidade, produto_id], function(err) {
            if (err) {
                return res.status(400).json({ error: err.message });
            }

            
            const itemExistente = carrinho.find(item => item.produto_id === produto_id);
            if (itemExistente) {
                itemExistente.quantidade += quantidade; 
            } else {
                carrinho.push({ produto_id, quantidade }); 
            }

            res.status(201).json({ message: 'Produto adicionado ao carrinho', carrinho });
        });
    });
});


app.put('/carrinho/:produto_id', (req, res) => {
    const { produto_id } = req.params;
    const { quantidade } = req.body;

    const itemExistente = carrinho.find(item => item.produto_id === Number(produto_id));
    if (!itemExistente) {
        return res.status(404).json({ message: 'Produto não encontrado no carrinho.' });
    }

    itemExistente.quantidade = quantidade; 
    res.json({ message: 'Quantidade atualizada no carrinho', carrinho });
});

app.delete('/carrinho/:produto_id', (req, res) => {
    const { produto_id } = req.params;

    const index = carrinho.findIndex(item => item.produto_id === Number(produto_id));
    if (index === -1) {
        return res.status(404).json({ message: 'Produto não encontrado no carrinho.' });
    }

    const quantidadeRemovida = carrinho[index].quantidade;

    db.get('SELECT quantidade FROM produtos WHERE id = ?', [produto_id], (err, produto) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }

        const novaQuantidade = produto.quantidade + quantidadeRemovida;

        
        db.run('UPDATE produtos SET quantidade = ? WHERE id = ?', [novaQuantidade, produto_id], (err) => {
            if (err) {
                return res.status(400).json({ error: err.message });
            }

            
            carrinho.splice(index, 1);
            res.json({ message: 'Produto removido do carrinho', carrinho });
        });
    });
});

app.put('/produtos/:id', (req, res) => {
    const { id } = req.params;
    const { nome, preco } = req.body;
    const sql = 'UPDATE produtos SET nome = ?, preco = ? WHERE id = ?';
    db.run(sql, [nome, preco, id], function(err) {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        res.json({ id, nome, preco });
    });
});

app.delete('/produtos/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM produtos WHERE id = ?';
    db.run(sql, id, function(err) {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        res.json({ message: 'Produto deletado com sucesso' });
    });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
