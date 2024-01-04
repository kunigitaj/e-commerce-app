// storefront-app/components/Navbar.js

import { Flex, Box, Button, Text, IconButton, useDisclosure, Collapse } from '@chakra-ui/react';
import Link from 'next/link';
import { FiShoppingCart, FiMenu } from 'react-icons/fi';
import { useCart } from '../contexts/cartContext';

const Navbar = () => {
  const { isOpen, onToggle } = useDisclosure();
  const { cartItems, calculateTotal } = useCart();

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalCost = calculateTotal();

  return (
    <Flex 
      as="nav" 
      direction={["column", "row"]} 
      justifyContent="space-between" 
      alignItems="center" 
      p="4" 
      bg="blue.500" 
      color="white" 
      wrap="wrap"
    >
      <Flex justify={["space-between", "initial"]} align="center" width={["full", "auto"]} mb={[4, 0]}>
        <IconButton 
          aria-label="Open Menu" 
          size="md" 
          mr={2} 
          icon={<FiMenu />} 
          display={["flex", "none"]} 
          onClick={onToggle} 
        />
        <Box p="2" display={["none", "flex"]}>
          <Link href="/" passHref><Button colorScheme="teal" mr="4">Home</Button></Link>
          <Link href="/products" passHref><Button colorScheme="teal" mr="4">Products</Button></Link>
          <Link href="/cart" passHref><Button colorScheme="teal" mr="4">Cart</Button></Link>
        </Box>
      </Flex>
      <Collapse in={isOpen} animateOpacity>
        <Box p="2" display={["block", "none"]} width="full">
          <Link href="/" passHref><Button colorScheme="teal" mr="4" w="full">Home</Button></Link>
          <Link href="/products" passHref><Button colorScheme="teal" mr="4" w="full">Products</Button></Link>
          <Link href="/cart" passHref><Button colorScheme="teal" mr="4" w="full">Cart</Button></Link>
        </Box>
      </Collapse>
      <Flex align="center">
        <FiShoppingCart size="1.5em" />
        {cartItems.length > 0 && (
          <>
            <Text ml="2" mr="4">{`Products: ${cartItems.length}`}</Text>
            <Text mr="4">{`Items: ${totalItems}`}</Text>
            <Text mr="4">{`Total: $${totalCost.toFixed(2)}`}</Text>
            <Link href="/checkout" passHref>
              <Button colorScheme="teal" size="sm">Checkout</Button>
            </Link>
          </>
        )}
      </Flex>
    </Flex>
  );
};

export default Navbar;
