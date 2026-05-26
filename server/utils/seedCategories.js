const { db } = require('../database');

const DEFAULT_CATEGORIES = [
  { name: 'Alimentação',       is_income: 0 },
  { name: 'Transporte',        is_income: 0 },
  { name: 'Moradia',           is_income: 0 },
  { name: 'Saúde',             is_income: 0 },
  { name: 'Lazer',             is_income: 0 },
  { name: 'Compras',           is_income: 0 },
  { name: 'Educação',          is_income: 0 },
  { name: 'Contas',            is_income: 0 },
  { name: 'Cuidados Pessoais', is_income: 0 },
  { name: 'Salário',           is_income: 1 },
  { name: 'Freelance',         is_income: 1 },
  { name: 'Outros',            is_income: 1 },
];

function seedDefaultCategories(userId) {
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO categories (name, is_income, user_id) VALUES (?, ?, ?)'
  );
  for (const { name, is_income } of DEFAULT_CATEGORIES) {
    stmt.run(name, is_income, userId);
  }
}

module.exports = { seedDefaultCategories };
