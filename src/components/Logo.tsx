"use client";

import React from "react";
import Link from "next/link";
import { Playfair_Display } from "next/font/google";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { CassandraLogo } from "./CassandraLogo"; // Import the SVG logo

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: "700",
});

interface LogoProps {
  className?: string;
  hideText?: boolean; // Prop to control text visibility
}

export const Logo: React.FC<LogoProps> = ({ className, hideText = false }) => {
  return (
    <Link
      href={"/"}
      className={cn(
        "group flex items-center gap-2.5 transition-opacity duration-300 hover:opacity-80",
        className,
      )}
      aria-label="Cassandra Homepage"
    >
      <CassandraLogo className="h-6 w-6 text-amber-500 shrink-0" />

      <div className={cn("flex flex-col", hideText && "hidden")}>
        <span
          className={cn(
            "text-xl font-bold tracking-tighter leading-none",
            playfair.className
          )}
        >
          Cassandra
        </span>
        <span className="text-xs text-muted-foreground -mt-0.7 ml-1 text-xs">
          Foresight for Founders
        </span>
      </div>
    </Link>
  );
};

export default Logo;