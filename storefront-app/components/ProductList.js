// storefront-app/components/ProductList.js

import React, { useEffect, useState } from 'react';
import ProductCard from './ProductCard';
import TagCloud from './TagCloud';
import { SimpleGrid, Box, Select, Input } from '@chakra-ui/react';

const ProductList = () => {
  const [products, setProducts] = useState([]);
  const [sortOrder, setSortOrder] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagFrequencies, setTagFrequencies] = useState({});

  useEffect(() => {
    fetch('/api/products', { cache: 'no-store' })
      .then(response => {
        console.log('ProductList fetch response status:', response.status);
        console.log('ProductList fetch response headers:', response.headers);
        if (!response.ok) {
          console.error('ProductList fetch response not ok:', response);
          throw new Error(`Network response was not ok, status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('ProductList fetched products:', data);
        setProducts(data);
        // Calculate tag frequencies
        const frequencies = {};
        data.forEach(product => {
          product.tags.forEach(tag => {
            frequencies[tag] = (frequencies[tag] || 0) + 1;
          });
        });
        setTagFrequencies(frequencies);
      })
      .catch(error => console.error('Error fetching products:', error));
  }, []);

  const categories = [...new Set(products.map(p => p.category))];
  const tags = [...new Set(products.flatMap(p => p.tags))];

  let filteredProducts = products
    .filter(product =>
      selectedCategory ? product.category === selectedCategory : true
    )
    .filter(product =>
      searchTerm ? product.name.toLowerCase().includes(searchTerm.toLowerCase()) || product.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())) : true
    )
    .filter(product =>
      selectedTags.length > 0 ? selectedTags.some(tag => product.tags.includes(tag)) : true
    );

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortOrder === 'asc') {
      return a.name.localeCompare(b.name);
    }
    if (sortOrder === 'desc') {
      return b.name.localeCompare(a.name);
    }
    return 0;
  });

  // Function to determine font size based on frequency
  const getFontSize = (tag) => {
    const frequency = tagFrequencies[tag];
    return Math.min(12 + frequency * 2, 24);
  };

  return (
    <Box p="4" maxW="container.xl" mx="auto">
      <Box mb="6">
        <Input
          placeholder="Search products"
          onChange={(e) => setSearchTerm(e.target.value)}
          mb="4"
          size="lg"
          shadow="sm"
        />
        <Select
          placeholder="Select category"
          onChange={(e) => setSelectedCategory(e.target.value)}
          mb="4"
          size="lg"
          shadow="sm"
        >
          {categories.map(category => (
            <option key={category} value={category}>{category}</option>
          ))}
        </Select>
        <TagCloud
          tags={tags}
          selectedTags={selectedTags}
          setSelectedTags={setSelectedTags}
          getFontSize={getFontSize}
        />
      </Box>
      <Select
        placeholder="Sort by"
        onChange={(e) => setSortOrder(e.target.value)}
        mb="4"
        size="lg"
        shadow="sm"
      >
        <option value="asc">Name Ascending</option>
        <option value="desc">Name Descending</option>
      </Select>
      <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} spacing="10">
        {sortedProducts.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </SimpleGrid>
    </Box>
  );
};

export default ProductList;