import { NextResponse } from 'next/server';
import { withAuth } from '../../../lib/auth';
import { redisHelpers } from '../../../lib/redis';

// Mock data for now - replace with database integration later
const mockTransactions = [
  {
    id: '1',
    amount: -25.50,
    description: 'Coffee Shop',
    category: 'Food & Dining',
    date: '2024-02-01',
    type: 'expense'
  },
  {
    id: '2',
    amount: 1500.00,
    description: 'Salary',
    category: 'Income',
    date: '2024-02-01',
    type: 'income'
  }
];

async function getTransactionsHandler(request: any): Promise<NextResponse> {
  try {
    // Get the user from authentication
    const user = request.user;
    if (!user || !user.id) {
      return NextResponse.json(
        { success: false, error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Get transactions from Redis
    const transactions = await redisHelpers.getUserTransactions(user.id);

    return NextResponse.json({
      success: true,
      data: transactions,
      count: transactions.length
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}

async function createTransactionHandler(request: any): Promise<NextResponse> {
  try {
    // Get the user from authentication
    const user = request.user;
    if (!user || !user.id) {
      return NextResponse.json(
        { success: false, error: 'User not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Basic validation
    if (!body.amount || !body.description) {
      return NextResponse.json(
        { success: false, error: 'Amount and description are required' },
        { status: 400 }
      );
    }

    // Create transaction with user ID
    const newTransaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: user.id,
      amount: body.amount,
      description: body.description,
      category: body.category || 'Uncategorized',
      date: body.date || new Date().toISOString().split('T')[0],
      type: (body.amount >= 0 ? 'income' : 'expense') as 'income' | 'expense',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to Redis
    await redisHelpers.addUserTransaction(user.id, newTransaction);

    return NextResponse.json({
      success: true,
      data: newTransaction
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating transaction:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create transaction' },
      { status: 500 }
    );
  }
}

// Export protected handlers
export const GET = withAuth(getTransactionsHandler);
export const POST = withAuth(createTransactionHandler);