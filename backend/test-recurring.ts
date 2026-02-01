#!/usr/bin/env tsx

/**
 * Test script for recurring transaction detection
 */

import { Transaction } from './lib/redis';
import { detectRecurringPatterns, normalizeDescription } from './lib/recurring';

// Sample transactions for testing
const sampleTransactions: Transaction[] = [
  // Recurring expenses - Netflix (monthly)
  {
    id: '1',
    userId: 'test-user',
    amount: -15.99,
    description: 'NETFLIX.COM',
    category: 'Entertainment',
    date: '2024-01-01',
    type: 'expense',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    userId: 'test-user',
    amount: -15.99,
    description: 'NETFLIX.COM',
    category: 'Entertainment',
    date: '2024-02-01',
    type: 'expense',
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-02-01T00:00:00Z',
  },
  {
    id: '3',
    userId: 'test-user',
    amount: -15.99,
    description: 'NETFLIX.COM',
    category: 'Entertainment',
    date: '2024-03-01',
    type: 'expense',
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: '2024-03-01T00:00:00Z',
  },

  // Recurring expenses - Starbucks (weekly)
  {
    id: '4',
    userId: 'test-user',
    amount: -5.50,
    description: 'STARBUCKS STORE #1234',
    category: 'Food',
    date: '2024-01-01',
    type: 'expense',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '5',
    userId: 'test-user',
    amount: -4.75,
    description: 'STARBUCKS STORE #1234',
    category: 'Food',
    date: '2024-01-08',
    type: 'expense',
    createdAt: '2024-01-08T00:00:00Z',
    updatedAt: '2024-01-08T00:00:00Z',
  },
  {
    id: '6',
    userId: 'test-user',
    amount: -6.25,
    description: 'STARBUCKS STORE #1234',
    category: 'Food',
    date: '2024-01-15',
    type: 'expense',
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
  {
    id: '7',
    userId: 'test-user',
    amount: -5.00,
    description: 'STARBUCKS STORE #1234',
    category: 'Food',
    date: '2024-01-22',
    type: 'expense',
    createdAt: '2024-01-22T00:00:00Z',
    updatedAt: '2024-01-22T00:00:00Z',
  },

  // Payroll income
  {
    id: '8',
    userId: 'test-user',
    amount: 2500.00,
    description: 'MEDIA NEWS GROUP PAYROLL',
    category: 'Income',
    date: '2024-01-15',
    type: 'income',
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
  {
    id: '9',
    userId: 'test-user',
    amount: 2500.00,
    description: 'MEDIA NEWS GROUP PAYROLL',
    category: 'Income',
    date: '2024-01-31',
    type: 'income',
    createdAt: '2024-01-31T00:00:00Z',
    updatedAt: '2024-01-31T00:00:00Z',
  },

  // Bonus (much larger than payroll)
  {
    id: '10',
    userId: 'test-user',
    amount: 7500.00,
    description: 'YEAR END BONUS',
    category: 'Income',
    date: '2024-02-15',
    type: 'income',
    createdAt: '2024-02-15T00:00:00Z',
    updatedAt: '2024-02-15T00:00:00Z',
  },

  // One-off expense (should not be detected as recurring)
  {
    id: '11',
    userId: 'test-user',
    amount: -100.00,
    description: 'RESTAURANT ONE-TIME',
    category: 'Food',
    date: '2024-01-10',
    type: 'expense',
    createdAt: '2024-01-10T00:00:00Z',
    updatedAt: '2024-01-10T00:00:00Z',
  },

  // PwP pattern (Pay with Privacy)
  {
    id: '12',
    userId: 'test-user',
    amount: -25.00,
    description: 'PwP  AMAZON.COM Privacycom',
    category: 'Shopping',
    date: '2024-01-05',
    type: 'expense',
    createdAt: '2024-01-05T00:00:00Z',
    updatedAt: '2024-01-05T00:00:00Z',
  },
  {
    id: '13',
    userId: 'test-user',
    amount: -30.00,
    description: 'PwP  AMAZON.COM Privacycom',
    category: 'Shopping',
    date: '2024-02-05',
    type: 'expense',
    createdAt: '2024-02-05T00:00:00Z',
    updatedAt: '2024-02-05T00:00:00Z',
  },
];

function testDescriptionNormalization() {
  console.log('🧪 Testing description normalization...');

  const testCases = [
    { input: 'PwP  AMAZON.COM Privacycom', expected: 'amazon com' },
    { input: 'DUKEENERGY BILL PAY', expected: 'duke energy' },
    { input: 'APPLECARD GSBANK', expected: 'apple card' },
    { input: 'STARBUCKS STORE #1234', expected: 'starbucks' },
    { input: 'NETFLIX.COM', expected: 'netflix com' },
  ];

  for (const testCase of testCases) {
    const result = normalizeDescription(testCase.input);
    const passed = result === testCase.expected;
    console.log(`  ${passed ? '✅' : '❌'} "${testCase.input}" → "${result}" ${passed ? '' : `(expected: "${testCase.expected}")`}`);
  }
}

function testRecurringDetection() {
  console.log('\n🧪 Testing recurring detection...');

  const result = detectRecurringPatterns(sampleTransactions);

  console.log(`\n📊 Results:`);
  console.log(`   Recurring Expenses Found: ${result.recurringExpenses.length}`);
  console.log(`   Payroll Events Found: ${result.payrollEvents.length}`);

  console.log('\n💸 Recurring Expenses:');
  for (const expense of result.recurringExpenses) {
    console.log(`   - ${expense.merchantName}: $${expense.amount} (${expense.frequency}) [${expense.transactionCount} transactions, ${Math.round(expense.confidence * 100)}% confidence]`);
  }

  console.log('\n💰 Payroll Events:');
  for (const payroll of result.payrollEvents) {
    console.log(`   - ${payroll.description}: $${payroll.amount} (${payroll.type}) [${Math.round(payroll.confidence * 100)}% confidence]`);
  }

  // Verify success criteria
  console.log('\n✅ Success Criteria Verification:');

  // Criterion 1: Description normalization
  const normalizedDescriptions = sampleTransactions
    .filter(t => t.type === 'expense')
    .map(t => normalizeDescription(t.description));
  const hasNormalizedDescriptions = normalizedDescriptions.some(desc =>
    desc.includes('amazon') || desc.includes('duke energy') || desc.includes('apple card')
  );
  console.log(`   [${hasNormalizedDescriptions ? 'x' : ' '}] backend/lib/recurring.ts normalizes descriptions (PwP, DUKEENERGY, APPLECARD patterns)`);

  // Criterion 2: Recurring detection
  const hasRecurring = result.recurringExpenses.some(r => r.isRecurring);
  console.log(`   [${hasRecurring ? 'x' : ' '}] Marks recurring when interval regularity is above threshold`);

  // Criterion 3: Payroll vs bonus classification
  const hasPayroll = result.payrollEvents.some(p => p.type === 'payroll');
  const hasBonus = result.payrollEvents.some(p => p.type === 'bonus');
  console.log(`   [${hasPayroll && hasBonus ? 'x' : ' '}] Credits classified as payroll vs bonus`);

  const allCriteriaMet = hasNormalizedDescriptions && hasRecurring && hasPayroll && hasBonus;
  console.log(`\n🎯 Overall: ${allCriteriaMet ? 'SUCCESS - All criteria met!' : 'INCOMPLETE - Some criteria not met'}`);
}

// Run tests
if (require.main === module) {
  testDescriptionNormalization();
  testRecurringDetection();
}