export const getTokenImageUrl = (iconPath: string): string => {
  // If it's already a full URL, return as is
  if (iconPath.startsWith('http')) {
    return iconPath;
  }
  
  // Otherwise, construct the URL from a base path
  return `/images/tokens/${iconPath}`;
}; 