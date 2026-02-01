export const metadata = {
  title: 'Money Tracker Backend API',
  description: 'Backend API for Money Tracker application',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* API-only app - no UI rendering */}
        <div style={{ display: 'none' }}>
          {children}
        </div>
      </body>
    </html>
  );
}