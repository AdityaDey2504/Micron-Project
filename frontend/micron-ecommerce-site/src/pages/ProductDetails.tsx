import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { getProductById } from '../api/endpoints';
import { getProductReviews, postProductReview, type ProductReviewsResponse } from '../api/reviews';
import type { ProductDetailResponse } from '../types/api-types';
import { useApp } from '../context/AppContext';

export default function ProductDetails() {
  const { id } = useParams<{ id: string }>();
  const { addToCart } = useApp();

  // Product State
  const [product, setProduct] = useState<ProductDetailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [quantity, setQuantity] = useState<number>(1);
  const [added, setAdded] = useState<boolean>(false);

  // Reviews State
  const [reviewsData, setReviewsData] = useState<ProductReviewsResponse | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState<boolean>(true);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  
  // Review Form State
  const [rating, setRating] = useState<number>(5);
  const [title, setTitle] = useState<string>('');
  const [text, setText] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<boolean>(false);

  // Fetch Reviews Callback
  const fetchReviews = useCallback(async (productId: string) => {
    setReviewsLoading(true);
    setReviewsError(null);
    try {
      const data = await getProductReviews(productId);
      setReviewsData(data);
    } catch (err: any) {
      setReviewsError(err.message || 'Failed to load reviews');
    } finally {
      setReviewsLoading(false);
    }
  }, []);

  // Fetch Product & Initial Reviews
  useEffect(() => {
    if (id) {
      setLoading(true);
      getProductById(id)
        .then(setProduct)
        .finally(() => setLoading(false));

      fetchReviews(id);
    }
  }, [id, fetchReviews]);

  if (loading) return <div className="text-center py-12 text-xs text-slate-400">Loading product...</div>;
  if (!product) return <div className="text-center py-12 text-xs text-slate-400">Product not found.</div>;

  const isOutOfStock = product.stock !== undefined && product.stock !== null && product.stock <= 0;

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    
    addToCart(product.id, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handlePostReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setSubmitting(true);
    setFormError(null);
    setFormSuccess(false);

    try {
      await postProductReview(id, { rating, title, text });
      setTitle('');
      setText('');
      setRating(5);
      setFormSuccess(true);
      setTimeout(() => setFormSuccess(false), 8000);
      
      // Refresh reviews and summary after submission
      fetchReviews(id);
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit review. Make sure you are logged in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Main Product Details Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-8 space-y-6">
        <Link to="/products" className="text-xs text-indigo-600 font-medium hover:underline inline-block">
          &larr; Back to catalogs
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="h-80 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-sm overflow-hidden">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              'Product Image'
            )}
          </div>

          <div className="flex flex-col justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 mb-2">{product.name}</h1>
              <div className="flex items-center space-x-3 mb-4">
                <span className="text-2xl font-bold text-indigo-600">₹{product.finalPrice}</span>
                {product.discountPercent > 0 && (
                  <span className="text-sm text-slate-400 line-through">₹{product.price}</span>
                )}
              </div>

              {product.description && (
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">{product.description}</p>
              )}

              {/* Stock rendering */}
              <div className="text-xs mb-6">
                {product.stock === null || product.stock === undefined ? (
                  <span className="text-slate-400 font-medium">Stock: Availability Unknown</span>
                ) : product.stock > 0 ? (
                  <span className="text-emerald-600 font-medium">In Stock ({product.stock} available)</span>
                ) : (
                  <span className="text-red-500 font-semibold">Out of Stock</span>
                )}
              </div>

              {/* Quantity Selector */}
              {!isOutOfStock && (
                <div className="flex items-center space-x-3 mb-6">
                  <span className="text-xs font-semibold text-slate-700">Quantity:</span>
                  <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="px-3 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 text-sm font-bold"
                    >
                      -
                    </button>
                    <span className="px-4 text-xs font-semibold text-slate-800">{quantity}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity((q) => (product.stock ? Math.min(product.stock, q + 1) : q + 1))
                      }
                      className="px-3 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 text-sm font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className={`w-full py-3 rounded-xl font-medium text-sm transition ${
                  added
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                } disabled:opacity-50`}
              >
                {isOutOfStock ? 'Sold Out' : added ? '✓ Added to Cart!' : 'Add to Cart'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews & Ratings Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-8 space-y-6">
        <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">
          Customer Reviews
        </h2>

        {reviewsLoading ? (
          <div className="text-xs text-slate-400 py-4">Loading ratings & reviews...</div>
        ) : reviewsError ? (
          <div className="text-xs text-red-500 py-2">{reviewsError}</div>
        ) : (
          <>
            {/* Rating Summary Header */}
            {reviewsData?.summary && (
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-extrabold text-slate-900">
                      {reviewsData.summary.average !== null ? reviewsData.summary.average.toFixed(1) : '0.0'}
                    </span>
                    <span className="text-slate-400 text-sm">/ 5.0</span>
                  </div>
                  <div className="text-xs text-amber-500 my-1">
                    {'★'.repeat(Math.round(reviewsData.summary.average || 0))}
                    {'☆'.repeat(5 - Math.round(reviewsData.summary.average || 0))}
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    Based on {reviewsData.summary.count} {reviewsData.summary.count === 1 ? 'review' : 'reviews'}
                  </p>
                </div>

                {/* Rating Breakdown Bars */}
                {reviewsData.summary.breakdown && (
                  <div className="w-full md:w-64 space-y-1.5 text-xs">
                    {([5, 4, 3, 2, 1] as const).map((stars) => {
                      const starCount = reviewsData.summary.breakdown?.[stars] || 0;
                      const totalCount = reviewsData.summary.count || 1;
                      const percentage = Math.round((starCount / totalCount) * 100);

                      return (
                        <div key={stars} className="flex items-center space-x-3 text-slate-600">
                          <span className="w-6 font-medium text-right text-slate-500">{stars}★</span>
                          <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-amber-400 h-full rounded-full transition-all duration-300"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="w-8 text-right text-slate-400 text-[11px]">{starCount}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Post a Review Form */}
            <form onSubmit={handlePostReview} className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">Write a Review</h3>

              {formError && (
                <div className="bg-red-50 text-red-600 text-xs p-3 rounded-lg border border-red-100">
                  {formError}
                </div>
              )}

              {formSuccess && (
                <div className="bg-emerald-50 text-emerald-600 text-xs p-3 rounded-lg border border-emerald-100">
                  ✓ Review submitted successfully!
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Rating</label>
                  <select
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                  >
                    <option value={5}>5 Stars - Excellent</option>
                    <option value={4}>4 Stars - Good</option>
                    <option value={3}>3 Stars - Average</option>
                    <option value={2}>2 Stars - Poor</option>
                    <option value={1}>1 Star - Terrible</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Title (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Great build quality!"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Review</label>
                <textarea
                  placeholder="What did you like or dislike about this product?"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 outline-none focus:border-indigo-500 h-24"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2 rounded-lg text-xs transition disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Review'}
              </button>
            </form>

            {/* Existing Reviews List */}
            <div className="space-y-4 pt-2">
              {!reviewsData?.items || reviewsData.items.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No reviews for this product yet. Be the first to leave one!</p>
              ) : (
                reviewsData.items.map((review) => (
                  <div key={review.id} className="border-b border-slate-100 pb-4 space-y-1.5 last:border-0">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-800">{review.author}</span>
                      <span className="text-slate-400 text-[11px]">{review.date}</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-amber-400 text-xs">
                        {'★'.repeat(review.rating)}
                        {'☆'.repeat(5 - review.rating)}
                      </span>
                      {review.title && (
                        <span className="font-medium text-xs text-slate-900">{review.title}</span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">{review.text}</p>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}