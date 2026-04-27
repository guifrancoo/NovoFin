export const CAT_ICONS = {
  'Alimentação':          { icon: '🛒', bg: '#fef3cd' },
  'Bares e Restaurantes': { icon: '🍔', bg: '#fff0e6' },
  'Moradia':              { icon: '🏠', bg: '#fde8e8' },
  'Transporte':           { icon: '🚗', bg: '#e8f4fd' },
  'Saúde':                { icon: '💊', bg: '#fde8e8' },
  'Educação':             { icon: '📚', bg: '#e8f4fd' },
  'Lazer':                { icon: '🎬', bg: '#f3e8fd' },
  'Viagem':               { icon: '✈️', bg: '#e8f4fd' },
  'Compras':              { icon: '🛍️', bg: '#fef3cd' },
  'Investimento':         { icon: '📈', bg: '#d5f5e3' },
  'Família':              { icon: '👨‍👩‍👧', bg: '#fde8e8' },
  'Telefone':             { icon: '📱', bg: '#eafaf1' },
  'Salário':              { icon: '💰', bg: '#d5f5e3' },
  'Receita':              { icon: '💰', bg: '#d5f5e3' },
  'Outras Rendas':        { icon: '💵', bg: '#d5f5e3' },
  'Contas':               { icon: '⚡', bg: '#e8f4fd' },
  'Presentes':            { icon: '🎁', bg: '#fde8e8' },
  'Trabalho':             { icon: '💼', bg: '#f0f0f0' },
  'Despesas do Trabalho': { icon: '💼', bg: '#f0f0f0' },
  'Outros':               { icon: '📦', bg: '#f0f0f0' },
  'Saques':               { icon: '💸', bg: '#fef3cd' },
  'Pagamentos Cartões':   { icon: '💳', bg: '#e8f4fd' },
  'Banco':                { icon: '🏦', bg: '#e8f4fd' },
  'Cuidados Pessoais':    { icon: '🪥', bg: '#fde8e8' },
};

export function getCatIcon(category) {
  return CAT_ICONS[category] || { icon: '📂', bg: '#f0f0f0' };
}
