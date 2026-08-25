const BASE_URL = 'http://localhost:8000';

const getAuthHeaders = () => {
  const token = localStorage.getItem('aura_auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export interface Review {
  id: string;
  productId: string;
  rating: number;
  title: string | null;
  text: string;
  author: string;
  date: string;
  source: string;
}

export interface RatingSummary {
  productId: string;
  count: number;
  average: number | null;
  breakdown: Record<1 | 2 | 3 | 4 | 5, number> | null;
}

export interface ProductReviewsResponse {
  items: Review[];
  total: number;
  limit: number;
  offset: number;
  summary: RatingSummary;
}

/**
 * Fetch list of reviews and summary for a single product.
 * GET /api/products/:id/reviews
 */
export async function getProductReviews(productId: string, limit = 20, offset = 0): Promise<ProductReviewsResponse> {
  const response = await fetch(`${BASE_URL}/api/products/${productId}/reviews?limit=${limit}&offset=${offset}`, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to load product reviews');
  }

  return response.json();
}

/**
 * Submit a new product review (Requires Auth Token).
 * POST /api/products/:id/reviews
 */
export async function postProductReview(
  productId: string,
  payload: { rating: number; title?: string; text: string }
): Promise<Review> {
  const response = await fetch(`${BASE_URL}/api/products/${productId}/reviews`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to submit review');
  }

  return response.json();
}