import { NextResponse } from 'next/server';

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

export async function GET() {
  try {
    // TODO: Implement database queries
    // For now, return mock data
    return NextResponse.json({
      success: true,
      data: mockTransactions,
      count: mockTransactions.length
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Basic validation
    if (!body.amount || !body.description) {
      return NextResponse.json(
        { success: false, error: 'Amount and description are required' },
        { status: 400 }
      );
    }

    // TODO: Save to database
    const newTransaction = {
      id: Date.now().toString(),
      ...body,
      date: body.date || new Date().toISOString().split('T')[0]
    };

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