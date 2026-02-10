export const metadata = {
  title: 'Money Tracker API',
  description: 'Backend API for Money Tracker application',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // API-only app - no UI rendering
  return null
}