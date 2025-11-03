import React from 'react';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url: string;
  stock_quantity: number;
}

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 flex flex-col h-full">
      <div className="relative">
        <img 
          src={product.image_url} 
          alt={product.name}
          className="w-full h-56 object-cover"
        />
        <span className="absolute top-3 right-3 text-xs bg-blue-600 text-white px-3 py-1 rounded-full font-medium">
          {product.category}
        </span>
      </div>
      
      <div className="p-5 flex flex-col flex-grow">
        <div className="mb-3">
          <h3 className="text-xl font-bold text-gray-800 mb-2 leading-tight">
            {product.name}
          </h3>
          <p className="text-gray-600 text-sm leading-relaxed line-clamp-3">
            {product.description}
          </p>
        </div>
        
        <div className="mt-auto">
          <div className="flex items-center justify-between mb-4">
            <span className="text-3xl font-bold text-green-600">
              ${product.price}
            </span>
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${
                product.stock_quantity > 20 ? 'bg-green-500' : 
                product.stock_quantity > 5 ? 'bg-yellow-500' : 'bg-red-500'
              }`}></div>
              <span className="text-sm text-gray-600 font-medium">
                {product.stock_quantity > 0 ? `${product.stock_quantity} in stock` : 'Out of stock'}
              </span>
            </div>
          </div>
          
          <button 
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
              product.stock_quantity > 0
                ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md transform hover:scale-105'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            disabled={product.stock_quantity === 0}
          >
            {product.stock_quantity > 0 ? 'Add to Cart' : 'Out of Stock'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;