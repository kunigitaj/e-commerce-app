// storefront-app/components/CartSummary.js

import { useCart } from '../contexts/cartContext';
import {
  Box,
  Text,
  Button,
  Flex,
  IconButton,
  Input,
  VStack,
  Divider,
  useColorModeValue
} from '@chakra-ui/react';
import Link from 'next/link';
import { AiOutlineMinus, AiOutlinePlus } from 'react-icons/ai';

const CartSummary = () => {
  const { cartItems, removeFromCart, updateQuantity, calculateTotal, fetchProductDetails } = useCart();
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  if (cartItems.length === 0) {
    return (
      <Box p={4} maxW={"md"} mx="auto">
        <Text fontSize="2xl">Your cart is empty.</Text>
      </Box>
    );
  }

  const handleQuantityChange = async (id, newQuantity) => {
    console.log(`Handling quantity change for product ID: ${id}`);
    console.log(`New requested quantity: ${newQuantity}`);

    const productDetails = await fetchProductDetails(id);
    console.log(`Fetched product details:`, productDetails);

    if (!productDetails) {
      console.warn(`Product details not found for product ID: ${id}`);
      return;
    }

    if (newQuantity <= productDetails.quantity && newQuantity > 0) {
      console.log(`Updating quantity for product ID: ${id} to ${newQuantity}`);
      updateQuantity(id, newQuantity);
    } else {
      console.warn(`Requested quantity for product ID: ${id} is out of bounds. Not updating.`);
    }
  };

  return (
    <VStack spacing={4} align="stretch" p={5} maxW={"md"} mx="auto">
      {cartItems.map(item => (
        <Box key={item.id} p={4} borderWidth="1px" borderRadius="lg" boxShadow="sm" borderColor={borderColor}>
          <Flex justifyContent="space-between" align="center">
            <Text flex="1" fontWeight="semibold">{item.name}</Text>
            <Flex align="center" mr={4}>
              <IconButton
                aria-label="Decrease quantity"
                icon={<AiOutlineMinus />}
                onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                size="sm"
                isDisabled={item.quantity <= 1}
              />
              <Input
                value={item.quantity}
                onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value))}
                size="sm"
                width="50px"
                mx={2}
                type="number"
                textAlign="center"
              />
              <IconButton
                aria-label="Increase quantity"
                icon={<AiOutlinePlus />}
                onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                size="sm"
              />
            </Flex>
            <Button colorScheme="red" size="sm" onClick={() => removeFromCart(item.id)}>Remove</Button>
          </Flex>
        </Box>
      ))}
      <Divider my={4} />
      <Flex justifyContent="space-between" align="center">
        <Text fontSize="xl" fontWeight="bold">Total Cost: ${calculateTotal().toFixed(2)}</Text>
        <Link href="/checkout" passHref>
          <Button colorScheme="teal" size="md">Checkout</Button>
        </Link>
      </Flex>
    </VStack>
  );
};

export default CartSummary;