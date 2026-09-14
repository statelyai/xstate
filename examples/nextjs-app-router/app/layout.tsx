export const metadata = {
  title: 'XState Example: Next.js App Router'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          margin: '0 auto',
          padding: '2rem',
          maxWidth: '32rem'
        }}
      >
        {children}
      </body>
    </html>
  );
}
