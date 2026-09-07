import { fileURLToPath } from 'url';
import { dirname } from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // Pin workspace root — avoids mis-detection when parent dirs contain lockfiles
    root: dirname(fileURLToPath(import.meta.url)),
  },
};
export default nextConfig;
