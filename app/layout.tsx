import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Nymbus Loan Navigator',
  description: 'Streamlined loan application with identity verification',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
                N
              </div>
              <span className="text-sm font-semibold tracking-tight text-slate-900">
                Nymbus Loan Navigator
              </span>
            </div>
          </header>
          <main className="flex flex-1 items-start justify-center px-4 py-8 sm:py-12">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
