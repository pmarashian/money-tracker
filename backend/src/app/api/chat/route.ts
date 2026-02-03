import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/auth';
import { redisOps, mtKeys } from '../../../lib/redis';
import { calculateFinancialHealth, getDefaultHealthSettings, HealthResult } from '../../../lib/health';
import { getDefaultUserSettings, UserSettings } from '../../../lib/settings';
import { RecurringPattern, PayrollBonusEvent } from '../../../lib/recurring';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatRequest {
  message: string;
}

export interface ChatResponse {
  reply: string;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await requireAuth(request);

    // Parse request body
    const body: ChatRequest = await request.json();
    if (!body.message || typeof body.message !== 'string' || body.message.trim() === '') {
      return NextResponse.json(
        { error: 'Message is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Load recurring expenses from Redis
    const recurringKey = mtKeys.recurring(user.id);
    const recurringJson = await redisOps.get(recurringKey);
    const recurring: RecurringPattern[] = recurringJson ? JSON.parse(recurringJson) : [];

    // Load payroll/bonus events from Redis
    const payrollKey = mtKeys.payroll(user.id);
    const payrollJson = await redisOps.get(payrollKey);
    const payrollBonusEvents: PayrollBonusEvent[] = payrollJson ? JSON.parse(payrollJson) : [];

    // Load user settings from Redis
    const settingsKey = mtKeys.settings(user.id);
    const settingsJson = await redisOps.get(settingsKey);
    const userSettings = settingsJson ? JSON.parse(settingsJson) : getDefaultUserSettings();

    // Calculate current financial health
    const healthSettings = settingsJson ? JSON.parse(settingsJson) : getDefaultHealthSettings();
    const healthResult: HealthResult = calculateFinancialHealth(
      payrollBonusEvents,
      recurring,
      healthSettings,
      userSettings
    );

    // Load previous chat messages for context (last 10 messages)
    const chatKey = mtKeys.chat(user.id);
    const chatJson = await redisOps.get(chatKey);
    const previousMessages: ChatMessage[] = chatJson ? JSON.parse(chatJson) : [];
    const recentMessages = previousMessages.slice(-10); // Keep only last 10 messages

    // Build system prompt describing the app and context
    const systemPrompt = buildSystemPrompt(recurring, payrollBonusEvents, healthResult, userSettings);

    // Prepare messages for OpenAI API
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...recentMessages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      { role: 'user', content: body.message }
    ];

    // Check if OpenAI is configured
    if (!openai) {
      return NextResponse.json({
        error: 'AI service not configured',
        details: 'OpenAI API key is not set in environment variables'
      }, { status: 503 });
    }

    // Call OpenAI chat completions API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Using cost-effective model
      messages,
      max_tokens: 1000,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content;
    if (!reply) {
      throw new Error('No response from OpenAI');
    }

    // Store the conversation (user message + assistant reply)
    const timestamp = new Date().toISOString();
    const newMessages: ChatMessage[] = [
      ...recentMessages,
      { role: 'user', content: body.message, timestamp },
      { role: 'assistant', content: reply, timestamp }
    ];

    // Keep only the last N messages (configurable, default 20)
    const maxMessages = 20;
    const messagesToStore = newMessages.slice(-maxMessages);

    // Store in Redis
    await redisOps.set(chatKey, JSON.stringify(messagesToStore));

    const response: ChatResponse = { reply };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Chat error:', error);

    // Handle authentication errors
    if (error instanceof Error && (error as any).status === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle OpenAI errors
    if (error instanceof Error && error.message.includes('OpenAI')) {
      return NextResponse.json({
        error: 'AI service temporarily unavailable',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }, { status: 503 });
    }

    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Build the system prompt describing the Money Tracker app and providing context
 */
function buildSystemPrompt(
  recurring: RecurringPattern[],
  payrollBonusEvents: PayrollBonusEvent[],
  healthResult: HealthResult,
  userSettings: UserSettings
): string {
  const prompt = `You are a helpful financial advisor AI for the Money Tracker app.

## About Money Tracker App

Money Tracker is a personal finance app that helps users track their financial health. Key features:

- **Income Tracking**: Users upload bank statements (Chase CSV format) to detect recurring income
- **Recurring Detection**: Automatically identifies recurring expenses and income patterns
- **Financial Health**: Calculates projected balance over 90 days based on income and expenses
- **Payroll vs Bonus**: Distinguishes between regular payroll and bonus income
- **Bi-weekly Pay**: Assumes paychecks occur every 14 days
- **Health Metrics**: Determines if projected balance is "not_enough", "enough", or "too_much"

## Current User Context

**Financial Health Status**: ${healthResult.status}
**Projected Balance (90 days)**: $${healthResult.projectedBalance.toFixed(2)}

**Recurring Expenses**:
${recurring.map(r => `- ${r.name}: $${Math.abs(r.amount).toFixed(2)} (${r.frequency})`).join('\n')}

**Payroll History**:
${payrollBonusEvents.filter(e => e.type === 'payroll').slice(-3).map(p =>
  `- $${p.amount.toFixed(2)} on ${p.date}`
).join('\n')}

**Bonus History**:
${payrollBonusEvents.filter(e => e.type === 'bonus').slice(-3).map(b =>
  `- $${b.amount.toFixed(2)} on ${b.date}`
).join('\n')}

**User Settings**:
- Balance: $${userSettings.balance.toFixed(2)}
- Paycheck Amount: $${userSettings.paycheckAmount.toFixed(2)}
- Next Bonus Date: ${userSettings.nextBonusDate || 'Not set'}
- Bonus Amount: ${userSettings.bonusAmount ? `$${userSettings.bonusAmount.toFixed(2)}` : 'Not set'}

## Your Role

Help users understand their financial health and provide actionable advice. Focus on:
- Explaining their current financial situation
- Providing what-if scenarios and projections
- Suggesting ways to improve their financial health
- Answering questions about their spending patterns
- Offering guidance on budget management

Be helpful, accurate, and encouraging. Use the provided data to give specific, personalized advice.

If asked about technical details or features not mentioned above, explain that you're focused on financial health analysis based on the available data.`;

  return prompt;
}