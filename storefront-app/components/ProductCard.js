// storefront-app/components/ProductCard.js

import {
  Box,
  Image,
  Text,
  Button,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Flex,
  Badge,
  VStack,
  Tag,
  TagLabel,
  HStack
} from '@chakra-ui/react';
import { useCart } from '../contexts/cartContext';
import { useToast } from '@chakra-ui/react';

const ProductCard = ({ product }) => {
  const toast = useToast();
  const { cartItems, addToCart } = useCart();
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Check if the product is already at max quantity in the cart
  const isMaxQuantityInCart = () => {
    const cartItem = cartItems.find(item => item.id === product.id);
    return cartItem && cartItem.quantity >= product.quantity;
  };

  const handleAddToCart = (e) => {
    e.stopPropagation();
    addToCart(product);
    toast({
      title: "Added to Cart",
      description: `${product.name} added to your cart.`,
      status: "success",
      duration: 1000,
      isClosable: true,
    });
  };

  return (
    <>
      <Box borderWidth="1px" borderRadius="lg" overflow="hidden" p="6"
        _hover={{ shadow: "xl", cursor: "pointer", transform: "scale(1.05)", transition: "transform 0.3s ease-in-out" }}
        onClick={onOpen}>
        <Flex justify="center" align="center" h="200px">
          <Image src={product.imageUrl} alt={product.name} objectFit="cover" maxH="200px" boxShadow="xl" borderRadius="md" />
        </Flex>
        <Flex justify="space-between" align="center" mt="2">
          <VStack align="flex-start">
            <Text fontWeight="bold" noOfLines={1}>{product.name}</Text>
            <Tag colorScheme={product.quantity > 0 ? "green" : "red"}>
              {product.quantity > 0 ? `${product.quantity} in stock` : `Out of stock`}
            </Tag>
          </VStack>
          <Badge colorScheme="green">${product.price.toFixed(2)}</Badge>
        </Flex>
        <Button colorScheme="blue" mt="2" w="full" onClick={handleAddToCart} isDisabled={product.quantity === 0 || isMaxQuantityInCart()}>
          Add to Cart
        </Button>
      </Box>

      <Modal isOpen={isOpen} onClose={onClose} isCentered size="3xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader textAlign="center">{product.name}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Flex direction={["column", "row"]} gap="6" align="center">
              <Box flexShrink={0}>
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  boxSize="300px"
                  objectFit="cover"
                  borderRadius="md"
                  boxShadow="0px 8px 24px rgba(0, 0, 0, 0.15)" // Added shadow
                />
              </Box>
              <VStack align="start" spacing="4">
                <Text fontSize="xl">{product.description}</Text>
                <HStack spacing="2" wrap="wrap">
                  {product.tags.map((tag, index) => (
                    <Tag key={index} colorScheme="blue" borderRadius="full">
                      <TagLabel>{tag}</TagLabel>
                    </Tag>
                  ))}
                </HStack>
                <Text fontSize="2xl" fontWeight="bold" color="green.500">${product.price.toFixed(2)}</Text>
                <Text fontWeight="bold" color={product.quantity > 0 ? "green.500" : "red.500"}>
                  {product.quantity > 0 ? `${product.quantity} in stock` : `Out of stock`}
                </Text>
                <Button
                  colorScheme="blue"
                  onClick={(e) => { e.stopPropagation(); handleAddToCart(e); }}
                  isDisabled={product.quantity === 0 || isMaxQuantityInCart()}
                  size="lg"
                >
                  Add to Cart
                </Button>
              </VStack>
            </Flex>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
};

export default ProductCard;
