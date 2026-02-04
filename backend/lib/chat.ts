import OpenAI from 'openai';
import { redisOps, redisKeys } from './redis';
import { calculateFinancialHealth } from './health';
import { getUserSettings } from './settings';
import { RecurringPattern } from './recurring';
import { IncomeEvent } from './payroll';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Chat message interface
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

/**
 * Generate system prompt describing the app and user's financial context
 */
function generateSystemPrompt(
  recurringExpenses: RecurringPattern[],
  healthProjection: any,
  userSettings: any
): string {
  const recurringSummary = recurringExpenses
    .map(expense => `${expense.name}: $${Math.abs(expense.amount)} ${expense.frequency}`)
    .join('\n');

  const healthStatus = healthProjection.status;
  const projectedBalance = healthProjection.projectedBalance;
  const netFlow = healthProjection.breakdown.netFlow;

  const inflows = healthProjection.breakdown.inflows;
  const outflows = healthProjection.breakdown.outflows;

  return `You are a helpful financial advisor for a money tracker app. Here's the app description and user's current financial context:

APP DESCRIPTION:
- This is a money tracker app where users upload their Chase CSV transaction files
- The app automatically detects recurring expenses (monthly/weekly/bi-weekly patterns)
- Users have bi-weekly paychecks and occasional bonuses
- The app calculates a "financial health" metric based on projected inflows vs outflows over 90 days
- Health status can be: "not_enough" (negative net flow), "enough" (balanced), or "too_much" (significant surplus)

USER'S CURRENT FINANCIAL CONTEXT:
- Paycheck amount: $${userSettings.paycheckAmount} (bi-weekly)
- Current balance: $${userSettings.balance}
- Next bonus date: ${userSettings.nextBonusDate}
- Bonus amount: $${userSettings.bonusAmount || 0}

RECURRING EXPENSES DETECTED:
${recurringSummary || 'No recurring expenses detected yet'}

FINANCIAL HEALTH PROJECTION (90 days):
- Status: ${healthStatus}
- Projected net flow: $${netFlow}
- Inflows: $${inflows.total} (Payroll: $${inflows.payroll}, Bonus: $${inflows.bonus})
- Outflows: $${outflows.total} (Recurring: $${outflows.recurring})
- Projected balance change: $${projectedBalance}

INSTRUCTIONS:
- Be helpful, accurate, and encouraging
- Explain financial concepts clearly
- Provide actionable advice based on their actual data
- Reference their specific numbers and recurring expenses
- Suggest ways to improve their financial health status
- Answer questions about their spending patterns, income, and financial projections
- If they ask for advice, base it on their real financial situation
- Be conversational and supportive`;
}

/**
 * Load user's financial context for chat
 */
async function loadUserContext(userId: string): Promise<{
  recurringExpenses: RecurringPattern[];
  healthProjection: any;
  userSettings: any;
}> {
  // Load recurring expenses
  const recurringKey = redisKeys.recurring(userId);
  const recurringData = await redisOps.get(recurringKey);
  let recurringExpenses: RecurringPattern[] = [];
  if (recurringData) {
    try {
      recurringExpenses = JSON.parse(recurringData);
    } catch (error) {
      console.error('Error parsing recurring expenses:', error);
    }
  }

  // Load health projection
  const healthProjection = await calculateFinancialHealth(userId);

  // Load user settings
  const userSettings = await getUserSettings(userId);

  return {
    recurringExpenses,
    healthProjection,
    userSettings,
  };
}

/**
 * Generate AI response using OpenAI
 */
async function generateAIResponse(
  userMessage: string,
  context: {
    recurringExpenses: RecurringPattern[];
    healthProjection: any;
    userSettings: any;
  },
  chatHistory: ChatMessage[] = []
): Promise<string> {
  const systemPrompt = generateSystemPrompt(
    context.recurringExpenses,
    context.healthProjection,
    context.userSettings
  );

  // Prepare messages for OpenAI
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...chatHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: userMessage },
  ];

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Using a cost-effective model
      messages,
      max_tokens: 1000,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || 'I apologize, but I couldn\'t generate a response right now.';
  } catch (error) {
    console.error('OpenAI API error:', error);
    return 'I\'m sorry, but I encountered an error processing your request. Please try again later.';
  }
}

/**
 * Load chat history from Redis
 */
async function loadChatHistory(userId: string, maxMessages: number = 10): Promise<ChatMessage[]> {
  const chatKey = redisKeys.chat(userId);
  const chatData = await redisOps.get(chatKey);

  if (!chatData) {
    return [];
  }

  try {
    const history: ChatMessage[] = JSON.parse(chatData);
    // Return last N messages for context
    return history.slice(-maxMessages);
  } catch (error) {
    console.error('Error parsing chat history:', error);
    return [];
  }
}

/**
 * Save chat message to history
 */
async function saveChatMessage(userId: string, message: ChatMessage, maxHistorySize: number = 50): Promise<void> {
  const chatKey = redisKeys.chat(userId);
  const currentHistory = await loadChatHistory(userId, maxHistorySize);

  // Add new message
  currentHistory.push(message);

  // Keep only the most recent messages
  const trimmedHistory = currentHistory.slice(-maxHistorySize);

  // Save back to Redis
  await redisOps.set(chatKey, JSON.stringify(trimmedHistory));
}

/**
 * Process a chat request
 */
export async function processChatRequest(
  userId: string,
  userMessage: string
): Promise<{ response: string; contextUsed: any }> {
  // Load user's financial context
  const context = await loadUserContext(userId);

  // Load recent chat history for context (optional)
  const chatHistory = await loadChatHistory(userId);

  // Generate AI response
  const response = await generateAIResponse(userMessage, context, chatHistory);

  // Save messages to history (optional feature)
  const userChatMessage: ChatMessage = {
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString(),
  };

  const assistantChatMessage: ChatMessage = {
    role: 'assistant',
    content: response,
    timestamp: new Date().toISOString(),
  };

  // Save both messages
  await saveChatMessage(userId, userChatMessage);
  await saveChatMessage(userId, assistantChatMessage);

  return {
    response,
    contextUsed: {
      recurringExpensesCount: context.recurringExpenses.length,
      healthStatus: context.healthProjection.status,
      netFlow: context.healthProjection.breakdown.netFlow,
    },
  };
}