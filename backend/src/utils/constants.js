const ROLES = { CUSTOMER: 'customer', ADMIN: 'admin' };

const ORDER_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

// Weights for the recommendation ranker. Sum to 1 so the final score is 0..1
// and stays comparable across queries.
const RANK_WEIGHTS = {
  semantic: 0.4,
  budgetFit: 0.3,
  discount: 0.2,
  notRecentlyPurchased: 0.1,
};

// "Did you already buy one of these?" window for the don't-buy warning.
const RECENT_PURCHASE_DAYS = 60;

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 100;

module.exports = {
  ROLES,
  ORDER_STATUS,
  RANK_WEIGHTS,
  RECENT_PURCHASE_DAYS,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
};
