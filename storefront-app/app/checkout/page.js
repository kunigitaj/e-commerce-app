// storefront-app/app/checkout/page.js

'use client'
import React, { useState } from 'react';
import {
  Box, Text, Button, List, ListItem, ListIcon, Divider, Input, FormControl, FormLabel, VStack, HStack, Grid, useToast, Select, Icon
} from '@chakra-ui/react';
import { useCart } from '../../contexts/cartContext';
import { MdCheckCircle, MdShoppingCart, MdPayment, MdEmail } from 'react-icons/md';

export default function CheckoutPage() {
  const { cartItems, calculateTotal, clearCart } = useCart();
  const toast = useToast();
  const [formData, setFormData] = useState({
    cardType: 'Visa',
    cardNumber: '1234 1234 1234 1234',
    expiryDate: '12/23',
    cvv: '123',
    billingAddress: '123 Main St',
    email: 'e_com_app_customer_1234@mailinator.com'
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const [orderPlaced, setOrderPlaced] = useState(false);

  if (cartItems.length === 0 && !orderPlaced) {
    return (
      <Box p={4}>
        <Text fontSize="2xl">Your cart is empty.</Text>
      </Box>
    );
  }

  if (orderPlaced) {
    return (
      <Box p={4}>
        <Text fontSize="2xl">Thank you for your order!</Text>
        <Text>Your order has been placed and will be processed soon.</Text>
      </Box>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    const simplifiedItems = cartItems.map(({ id, name, quantity, price }) => ({
      id, name, quantity, price
    }));
    const orderDetails = { items: simplifiedItems, total: calculateTotal(), paymentInfo: formData };
    let responseData;

    try {
      console.log('Submitting order:', JSON.stringify(orderDetails));
      const response = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderDetails),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        console.error('Response not OK, throwing exception');
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      responseData = await response.json();
      console.log('Order response:', JSON.stringify(responseData));

      // On successful order, clear cart and form
      if (clearCart && typeof clearCart === 'function') {
        clearCart();
        setOrderPlaced(true);
      }
      setFormData({ cardNumber: '', expiryDate: '', cvv: '', billingAddress: '', email: '' });

    } catch (error) {
      const errorData = {
        message: error.message,
        stack: error.stack,
        responseStatus: error.response ? error.response.status : 'No response status',
        responseBody: error.response ? JSON.stringify(await error.response.json()) : 'No response body'
      };
      console.log('Error data:', JSON.stringify(errorData));
      console.error('Error in order submission:', errorData);
      toast({
        title: "Error",
        description: "There was an issue with your order. Please try again.",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "top",
      });
      return; // To ensure the success toast does not display when there's an error
    }

    // Success toast outside of the try-catch block
    toast({
      title: `Order ${responseData.data.orderId} Confirmed`,
      description: `Estimated delivery: ${responseData.data.estimatedDeliveryDate}. Email sent to ${responseData.data.customerNotification.email}.`,
      status: "success",
      duration: 10000,
      isClosable: true,
      position: "top-right",
    });
  };

  return (
    <Box p={[2, 4, 6]}>
      <VStack spacing={5}>
        <Box w="full" maxW={"md"} mx="auto">
          <Text fontSize={["xl", "2xl"]} fontWeight="bold" mb={3}>Checkout</Text>
          <Box maxW={"md"} mx="auto">
            <Divider mb={4} borderColor="gray.300" />
          </Box>
          <List spacing={3}>
            {cartItems.length ? cartItems.map((item) => (
              <ListItem key={item.id} borderBottom="1px" borderColor="gray.200" pb={2} mb={2}>
                <HStack justifyContent="space-between">
                  <HStack>
                    <Icon as={MdShoppingCart} color="green.500" />
                    <Text fontSize="md">{`${item.name} - ${item.quantity} x $${item.price.toFixed(2)}`}</Text>
                  </HStack>
                  <Text fontWeight="bold">${(item.quantity * item.price).toFixed(2)}</Text>
                </HStack>
              </ListItem>
            )) : <Text>Your cart is empty.</Text>}
          </List>
          <Text fontSize="lg" fontWeight="semibold">Total Cost: ${calculateTotal().toFixed(2)}</Text>
        </Box>
        <Box maxW={"md"} mx="auto" w="full">
          <Divider my={4} borderColor="gray.300" />
        </Box>
        <form onSubmit={handleSubmit}>
          <VStack spacing={4} align="stretch">
            =            <Box>
              <Text fontSize="lg" fontWeight="bold" mb={2}>Payment Information</Text>
              <Grid templateColumns={["1fr", "1fr 3fr"]} gap={4}>
                <FormLabel htmlFor='cardType'>Card Type</FormLabel>
                <Select id='cardType' name="cardType" value={formData.cardType} onChange={handleChange} isRequired>
                  <option value="Visa">Visa</option>
                  <option value="Mastercard">Mastercard</option>
                  <option value="American Express">American Express</option>
                  <option value="Discover">Discover</option>
                </Select>

                <FormLabel htmlFor='cardNumber'>Card Number</FormLabel>
                <Input id='cardNumber' name="cardNumber" type='text' value={formData.cardNumber} onChange={handleChange} isRequired />

                <FormLabel htmlFor='expiryDate'>Expiry Date</FormLabel>
                <Input id='expiryDate' name="expiryDate" type='text' value={formData.expiryDate} onChange={handleChange} isRequired />

                <FormLabel htmlFor='cvv'>CVV</FormLabel>
                <Input id='cvv' name="cvv" type='text' value={formData.cvv} onChange={handleChange} isRequired />

                <FormLabel htmlFor='billingAddress'>Billing Address</FormLabel>
                <Input id='billingAddress' name="billingAddress" type='text' value={formData.billingAddress} onChange={handleChange} isRequired />

                <FormLabel htmlFor='email' display="flex" alignItems="center">
                  <Icon as={MdEmail} mr={2} />
                  Email
                </FormLabel>
                <Input id='email' name="email" type='text' value={formData.email} onChange={handleChange} isRequired />
              </Grid>
            </Box>
            <Button colorScheme="teal" w="full" size="lg" leftIcon={<MdPayment />} type="submit">Complete Purchase</Button>
          </VStack>
        </form>
      </VStack>
    </Box>
  );
}