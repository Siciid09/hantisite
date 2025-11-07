"use client";

import React, { ReactNode } from "react";
import { ThemeProvider, ThemeProviderProps } from "next-themes";

interface Props {
  children: ReactNode;
}

const ThemeProviderWrapper: React.FC<Props> = ({ children }) => {
  return (
    <ThemeProvider
      {...({ children } as ThemeProviderProps)} // ✅ Type cast fix
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
    />
  );
};

export default ThemeProviderWrapper;
