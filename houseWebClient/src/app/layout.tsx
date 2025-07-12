'use client';

import React from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { DeviceProvider } from '@/context/DeviceContext';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <AuthProvider>
          <DeviceProvider>
            {children}
          </DeviceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
