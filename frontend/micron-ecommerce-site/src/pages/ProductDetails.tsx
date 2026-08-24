import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { getProductById } from '../api/endpoints';
import type { ProductDetailResponse } from '../types/api-types';
import { useApp } from '../context/AppContext';

export default function ProductDetails() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<ProductDetailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [quantity, setQuantity] = useState<number>(1);
  const [added, setAdded] = useState<boolean>(false);

  const { addToCart } = useApp();

  useEffect(() => {
    if (id) {
      getProductById(id)
        .then(setProduct)
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div className="text-center py-12 text-xs text-slate-400">Loading product...</div>;
  if (!product) return <div className="text-center py-12 text-xs text-slate-400">Product not found.</div>;

  const isOutOfStock = product.stock !== undefined && product.stock !== null && product.stock <= 0;

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    
    addToCart(product.id, quantity);

    // Show visual confirmation
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-4xl mx-auto space-y-6">
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
  );
}