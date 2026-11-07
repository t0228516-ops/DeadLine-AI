'use strict';
// Бағалар мен пакеттер (бір жерде). .env арқылы өзгертуге болады.
module.exports = {
  PRICE: 250,           // 1 кредит
  FIRST_PRICE: 100,     // бірінші сатып алу (1 кредит)
  // Сессия пакеті (2026-11-06, иесінің келісімі): 1 дана (250₸) мен Plus (50 дана) арасындағы саты — студентке семестрге 4–6
  // презентация керек. 990₸ 250-ге бөлінбейді → чек сомасы бойынша жай сатып алумен шатаспайды.
  PACK: {
    name: 'Сессия',
    amount: parseInt(process.env.PACK_PRICE || '990', 10),     // ₸
    credits: parseInt(process.env.PACK_CREDITS || '5', 10),    // кредит саны
  },
  PLUS: {
    name: 'Plus',
    amount: parseInt(process.env.PLUS_PRICE || '1990', 10),    // ₸
    credits: parseInt(process.env.PLUS_CREDITS || '50', 10),   // кредит саны
  },
};
/** Чек сомасы → кредит: барлық пакеттер (validateReceipt / reviewSeen) */
module.exports.BUNDLES = [module.exports.PACK, module.exports.PLUS];
/** Қолмен растауда (сома белгісіз) кредит санынан төленген соманы есептеу */
module.exports.paidFor = (credits, isFirstPurchase) => {
  const m = module.exports;
  const b = m.BUNDLES.find((x) => x.credits === credits);
  if (b) return b.amount;
  return isFirstPurchase && credits === 1 ? m.FIRST_PRICE : credits * m.PRICE;
};
