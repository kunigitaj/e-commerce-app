// storefront-app/components/TagCloud.js

import React from 'react';
import { Box } from '@chakra-ui/react';

const TagCloud = ({ tags, selectedTags, setSelectedTags, getFontSize }) => (
  <Box display="flex" flexWrap="wrap" gap="10px" mb="4">
    {tags.map(tag => (
      <Box
        key={tag}
        fontSize={`${getFontSize(tag)}px`}
        cursor="pointer"
        onClick={() => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
        bg={selectedTags.includes(tag) ? "blue.200" : "gray.200"}
        borderRadius="md"
        p="2"
      >
        {tag}
      </Box>
    ))}
  </Box>
);

export default TagCloud;
