import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/auth';
import { redisOps } from '../../../../lib/redis';
import { detectRecurringTransactions } from '../../../../lib/recurring';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if we have stored recurring patterns
    const recurringKey = `mt:recurring:${user.id}`;
    let recurringPatterns = await redisOps.get(recurringKey);

    if (!recurringPatterns) {
      // If no stored patterns, run detection on-demand
      const patterns = await detectRecurringTransactions(user.id);
      // Store the patterns for future requests
      await redisOps.set(recurringKey, JSON.stringify(patterns));
      recurringPatterns = JSON.stringify(patterns);
    }

    // Parse and return the patterns
    let patterns;
    try {
      patterns = JSON.parse(recurringPatterns);
    } catch (error) {
      console.error('Error parsing recurring patterns:', error);
      patterns = [];
    }

    return NextResponse.json({
      recurring: patterns
    });

  } catch (error) {
    console.error('Recurring patterns error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}