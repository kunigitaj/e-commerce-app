// storefront-app/app/page.js

'use client'
import React, { useState, useEffect } from 'react';
import { Box, Heading, SimpleGrid, Container } from '@chakra-ui/react';
import ProductCard from '../components/ProductCard';
import Carousel from '../components/Carousel';

export default function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [newProducts, setNewProducts] = useState([]);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [popularProducts, setPopularProducts] = useState([]);

  useEffect(() => {
    fetch('/api/products', { cache: 'no-store' })
      .then(response => {
        console.log('HomePage fetch products response status:', response.status);
        console.log('HomePage fetch products response headers:', response.headers);
        if (!response.ok) {
          throw new Error(`Network response was not ok, status: ${response.status}`);
        }
        return response.json();
      })
      .then(products => {
        setFeaturedProducts(products.slice(0, 4));
        setNewProducts(products.slice(-8));
      })
      .catch(error => console.error('HomePage error fetching products:', error));
  }, []);

  useEffect(() => {
    fetch('/api/recommendations', { cache: 'no-store' })
      .then(response => {
        console.log('HomePage fetch recommendations response status:', response.status);
        console.log('HomePage fetch recommendations response headers:', response.headers);
        if (!response.ok) {
          throw new Error(`Network response was not ok, status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setRecommendedProducts(data.products);
      })
      .catch(error => console.error('HomePage error fetching recommendations:', error));
  }, []);

  useEffect(() => {
    fetch('/api/popular', { cache: 'no-store' })
      .then(response => {
        console.log('HomePage fetch popular response status:', response.status);
        console.log('HomePage fetch popular response headers:', response.headers);
        if (!response.ok) {
          throw new Error(`Network response was not ok, status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setPopularProducts(data.popular_products);
      })
      .catch(error => console.error('HomePage error fetching popular products:', error));
  }, []);

  return (
    <Container maxW="container.xl" p={5}>
      <Heading as="h1" size="xl" textAlign="center" my="8">Welcome to Our Store</Heading>

      <Box my="8">
        <Heading as="h2" size="lg" mb="4">Recommendations</Heading>
        <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} spacing="10" px={5}>
          {recommendedProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </SimpleGrid>
      </Box>

      <Box my="8">
        <Heading as="h2" size="lg" mb="4">Popular Products</Heading>
        <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} spacing="10" px={5}>
          {popularProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </SimpleGrid>
      </Box>

      <Box my="8">
        <Heading as="h2" size="lg" mb="4">Featured Products</Heading>
        <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} spacing="10" px={5}>
          {featuredProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </SimpleGrid>
      </Box>

      <Box my="8">
        <Heading as="h2" size="lg" mb="4">New Arrivals</Heading>
        <Carousel items={newProducts} />
      </Box>
    </Container>
  );
}
