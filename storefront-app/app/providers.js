// astorefront-app/app/providers.js

'use client';
import { ChakraProvider } from '@chakra-ui/react';

export function Providers({ children }) {
  return (
  <html lang="en">
    <body><ChakraProvider>{children}</ChakraProvider></body>
  </html>
  );
}
