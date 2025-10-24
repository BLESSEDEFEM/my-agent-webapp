// Sample React component with performance issues
import React, { useState, useEffect } from 'react';

interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
}

interface Props {
  products: Product[];
  onProductClick: (id: number) => void;
}

// Issue 1: Missing memoization for expensive calculations
function ProductList({ products, onProductClick }: Props) {
  const [filter, setFilter] = useState('');
  
  // Issue 2: Expensive calculation on every render
  const expensiveCalculation = () => {
    let total = 0;
    for (let i = 0; i < products.length; i++) {
      for (let j = 0; j < 1000; j++) {
        total += products[i].price * Math.random();
      }
    }
    return total;
  };
  
  const totalValue = expensiveCalculation();
  
  // Issue 3: Creating new object on every render
  const filteredProducts = products.filter(p => {
    return p.name.toLowerCase().includes(filter.toLowerCase());
  });
  
  // Issue 4: Inline function creation in render
  return (
    <div>
      <input 
        value={filter} 
        onChange={(e) => setFilter(e.target.value)}
      />
      <p>Total Value: {totalValue}</p>
      {filteredProducts.map(product => (
        <div key={product.id} onClick={() => onProductClick(product.id)}>
          <h3>{product.name}</h3>
          <p>${product.price}</p>
          {/* Issue 5: Nested map without key optimization */}
          {products.map(p => (
            <span>{p.category}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

// Issue 6: Missing dependency in useEffect
function DataFetcher() {
  const [data, setData] = useState([]);
  const [page, setPage] = useState(1);
  
  useEffect(() => {
    fetch(`/api/data?page=${page}`)
      .then(r => r.json())
      .then(setData);
  }, []); // Missing 'page' dependency
  
  return <div>{JSON.stringify(data)}</div>;
}

export { ProductList, DataFetcher };