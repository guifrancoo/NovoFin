// Test extractLocation via parse().location (extractLocation is not exported directly)
const { parse } = require('./services/parser');

const cases = [
  'almocei 45 reais no débito',
  'almocei 45 reais no Outback',
  'comprei 80 reais no dinheiro no Carrefour',
  'gastei 30 reais no "iFood"',
  'paguei 120 reais de academia',
  'gastei 50 reais no débito no Mercado',
  'comprei 30 no cartão de débito',
];

for (const [i, input] of cases.entries()) {
  const { location, paymentMethod, needsCardSelection } = parse(input);
  console.log(`[${i + 1}] Input        : ${input}`);
  console.log(`    Location     : ${location ?? '(null)'}`);
  console.log(`    PaymentMethod: ${paymentMethod ?? '(null)'}`);
  console.log(`    CardSelection: ${needsCardSelection}`);
  console.log('---');
}
