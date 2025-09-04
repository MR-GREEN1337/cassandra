// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// MOCK STREAMING FUNCTION
export async function streamResponse(
  prompt: string,
  onChunk: (chunk: string) => void
) {
  const response = `This is a simulated streamed analysis for: "${prompt}". Key risks include market saturation and scaling challenges. A strong mitigation would be to target a hyper-niche audience first. The competitive landscape is fierce, but there's a gap in the premium market. Consider a subscription model for predictable revenue. This is a very interesting idea with great potential if executed correctly. Good luck!`;
  
  const words = response.split(' ');
  for (let i = 0; i < words.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, 50)); // Simulate network delay
    onChunk(words[i] + ' ');
  }
}


// Helper to convert any valid CSS color to an RGBA object
export function getRGBA(color: string): { r: number; g: number; b: number; a: number } | null {
  if (typeof window === 'undefined') return null; // Avoid server-side errors
  const tempDiv = document.createElement('div');
  tempDiv.style.color = color;
  document.body.appendChild(tempDiv);
  const computedColor = window.getComputedStyle(tempDiv).color;
  document.body.removeChild(tempDiv);
  
  const match = computedColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (match) {
    return {
      r: parseInt(match[1]),
      g: parseInt(match[2]),
      b: parseInt(match[3]),
      a: match[4] ? parseFloat(match[4]) : 1,
    };
  }
  return null; // Should not happen with valid CSS colors
}

// Helper to apply opacity to a pre-calculated RGBA color object
export function colorWithOpacity(rgba: { r: number; g: number; b: number; a: number } | null, opacity: number): string {
  if (!rgba) return '';
  return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a * opacity})`;
}