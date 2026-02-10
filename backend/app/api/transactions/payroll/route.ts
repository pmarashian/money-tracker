import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/auth';
import { redisOps } from '../../../../lib/redis';
import { detectPayrollAndBonus } from '../../../../lib/payroll';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if we have stored payroll/bonus events
    const payrollKey = `mt:payroll:${user.id}`;
    let payrollData = await redisOps.get(payrollKey);

    if (!payrollData) {
      // If no stored data, run detection on-demand
      const events = await detectPayrollAndBonus(user.id);
      // Store the events for future requests
      await redisOps.set(payrollKey, JSON.stringify(events));
      payrollData = JSON.stringify(events);
    }

    // Parse and return the events
    let events;
    try {
      events = JSON.parse(payrollData);
    } catch (error) {
      console.error('Error parsing payroll data:', error);
      events = [];
    }

    return NextResponse.json({
      payroll: events
    });

  } catch (error) {
    console.error('Payroll endpoint error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}