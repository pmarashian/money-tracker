import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { authenticateRequest } from '../../../lib/auth';
import { redisHelpers } from '../../../lib/redis';
import { calculateFinancialHealth } from '../../../lib/health';
import { RecurringExpense } from '../../../lib/recurring';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Helper function to get financial health for a user
 */
async function getFinancialHealth(userId: string) {
  try {
    const [userSettings, recurringCache] = await Promise.all([
      redisHelpers.getUserSettings(userId),
      redisHelpers.getUserRecurringCache(userId),
    ]);

    if (!userSettings || !recurringCache) {
      return null;
    }

    const recurringExpenses = recurringCache.recurringExpenses || [];
    return calculateFinancialHealth(userSettings, recurringExpenses);
  } catch (error) {
    console.error('Error calculating financial health:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = authResult.user.id;

    // Parse request body
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    // Load context data from Redis
    const [recurringCache, financialHealth, userSettings] = await Promise.all([
      redisHelpers.getUserRecurringCache(userId),
      getFinancialHealth(userId),
      redisHelpers.getUserSettings(userId),
    ]);

    const recurringExpenses = recurringCache?.recurringExpenses || [];

    // Load chat history (last 10 messages for context)
    const chatContext = await redisHelpers.getUserChatContext(userId);
    const recentMessages = chatContext?.messages.slice(-10) || []; // Last 10 messages

    // Build system prompt
    const systemPrompt = `You are a helpful financial assistant for a money tracking app. The app helps users track their finances with the following features:

- Users can upload bank statements (Chase format) to import transactions
- The app automatically detects recurring expenses (Netflix, utilities, etc.) and calculates typical amounts and frequencies
- Users can set financial settings: balance, bi-weekly paycheck amount, next bonus date, and bonus amount
- The app calculates financial health by projecting income (bi-weekly paychecks until bonus + bonus amount) and expenses (recurring expenses) to determine if the user will have enough money, too much money, or not enough money at bonus date

Current user context:
- Balance: $${userSettings?.balance || 0}
- Bi-weekly paycheck: $${userSettings?.paycheckAmount || 0}
- Next bonus date: ${userSettings?.nextBonusDate || 'Not set'}
- Bonus amount: $${userSettings?.bonusAmount || 0}

Recurring expenses:
${recurringExpenses?.map((expense: RecurringExpense) =>
  `- ${expense.merchantName}: $${expense.amount} ${expense.frequency}${expense.frequency === 'monthly' ? ` (typically on day ${expense.typicalDayOfMonth})` : ''}`
).join('\n') || 'None detected'}

Financial health status: ${financialHealth?.status || 'Unknown'} (projected balance at bonus date: $${financialHealth?.projectedBalance?.toFixed(2) || 'N/A'})

Provide helpful, actionable advice about their finances. Be conversational but informative. If they ask about what-if scenarios, use the financial data to provide realistic projections.`;

    // Prepare messages for OpenAI
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      // Include recent conversation history
      ...recentMessages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      // Add current user message
      { role: 'user', content: message }
    ];

    // Generate response using OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    const assistantReply = completion.choices[0]?.message?.content || 'I apologize, but I couldn\'t generate a response at this time.';

    // Store conversation in Redis (last 20 messages to keep context manageable)
    const messageId = Date.now().toString(); // Simple ID generation
    const userMessage = { id: `${messageId}-user`, role: 'user' as const, content: message, timestamp: new Date().toISOString() };
    const assistantMessage = { id: `${messageId}-assistant`, role: 'assistant' as const, content: assistantReply, timestamp: new Date().toISOString() };

    await redisHelpers.addChatMessage(userId, userMessage);
    await redisHelpers.addChatMessage(userId, assistantMessage);

    return NextResponse.json({
      success: true,
      reply: assistantReply,
    });

  } catch (error) {
    console.error('Chat API error:', error);

    // Handle specific OpenAI errors
    if (error instanceof Error && error.message.includes('OpenAI')) {
      return NextResponse.json(
        { success: false, error: 'AI service temporarily unavailable' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}