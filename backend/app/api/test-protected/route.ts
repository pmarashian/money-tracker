import { NextResponse } from 'next/server';
import { withAuth } from '../../../lib/auth';

// Force dynamic rendering for this route since it uses auth
export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request) => {
  // This code only runs if authentication succeeds
  const user = request.user!;

  return NextResponse.json({
    success: true,
    message: 'Protected route accessed successfully',
    user: {
      id: user.id,
      email: user.email,
    }
  });
});