"use client";

import React from "react";
import Link from "next/link";
import { Playfair_Display } from "next/font/google";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: "700",
});

interface LogoProps {
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className }) => {
  const pathname = usePathname();

  return (
    <Link
      href={pathname.startsWith("/dashboard") ? "/dashboard" : "/"}
      className={cn(
        "group flex items-center gap-2.5 transition-opacity duration-300 hover:opacity-80",
        className,
      )}
      aria-label="Alloy Homepage"
    >
        <span
          className={cn(
            "text-xl font-bold tracking-tighter text-white",
            playfair.className, className
          )}
        >
          Cassandra
        </span>
    </Link>
  );
};

export default Logo;