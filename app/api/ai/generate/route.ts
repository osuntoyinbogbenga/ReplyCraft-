import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';
import { generateReply } from '@/lib/ai';
import { sanitizeInput } from '@/lib/validation';
import { getNewsContext } from '@/lib/news';

const MAX_CONTEXT_MESSAGES = 20;

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!checkRateLimit(currentUser.userId, 50, 60000)) {
      return NextResponse.json({ 
        error: 'Too many requests. Please wait a moment.',
        errorType: 'rate_limit'
      }, { status: 429 });
    }

    const body = await request.json();
    const { chatId, userMessage, imageUrl } = body;

    if (!chatId || !userMessage) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        errorType: 'validation'
      }, { status: 400 });
    }

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat) {
      return NextResponse.json({ 
        error: 'Chat not found',
        errorType: 'not_found'
      }, { status: 404 });
    }

    if (chat.userId !== currentUser.userId) {
      return NextResponse.json({ 
        error: 'Forbidden',
        errorType: 'forbidden'
      }, { status: 403 });
    }

    const sanitizedMessage = sanitizeInput(userMessage);

    await prisma.message.create({
      data: {
        chatId,
        role: 'user',
        content: sanitizedMessage,
        imageUrl: imageUrl || null,
      },
    });

    const recentMessages = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'desc' },
      take: MAX_CONTEXT_MESSAGES,
      select: {
        role: true,
        content: true,
        imageUrl: true,
      },
    });

    const contextMessages = recentMessages.reverse().map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      imageUrl: msg.imageUrl || undefined,
    }));

    let newsContext = '';
    try {
      newsContext = await getNewsContext(sanitizedMessage);
      if (newsContext) {
        console.log('News context added for query:', sanitizedMessage.slice(0, 50));
      }
    } catch (error) {
      console.error('News fetch failed (continuing without context):', error);
    }

    let aiReply: string;
    try {
      aiReply = await generateReply(contextMessages, newsContext);
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      
      console.error('AI generation failed:', {
        userId: currentUser.userId,
        chatId,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });

      if (errorMessage.includes('AI_CONFIG_ERROR')) {
        return NextResponse.json({ 
          error: 'AI service is not configured. Please contact support.',
          errorType: 'config'
        }, { status: 500 });
      }

      if (errorMessage.includes('AUTH_ERROR')) {
        return NextResponse.json({ 
          error: 'AI authentication failed. Please contact support.',
          errorType: 'auth'
        }, { status: 500 });
      }

      if (errorMessage.includes('RATE_LIMIT')) {
        return NextResponse.json({ 
          error: 'AI service is busy. Please try again in a few moments.',
          errorType: 'ai_rate_limit'
        }, { status: 429 });
      }

      if (errorMessage.includes('CREDITS_ERROR')) {
        return NextResponse.json({ 
          error: 'AI service credits depleted. Please contact support.',
          errorType: 'credits'
        }, { status: 503 });
      }

      if (errorMessage.includes('TIMEOUT')) {
        return NextResponse.json({ 
          error: 'AI took too long to respond. Please try a shorter message.',
          errorType: 'timeout'
        }, { status: 504 });
      }

      if (errorMessage.includes('NETWORK_ERROR')) {
        return NextResponse.json({ 
          error: 'Cannot reach AI service. Please check your connection and try again.',
          errorType: 'network'
        }, { status: 503 });
      }

      return NextResponse.json({ 
        error: 'Failed to generate reply. Please try again.',
        errorType: 'unknown'
      }, { status: 500 });
    }

    const assistantMessage = await prisma.message.create({
      data: {
        chatId,
        role: 'assistant',
        content: aiReply,
      },
    });

    await prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ message: assistantMessage });
    
  } catch (error: any) {
    console.error('API route error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json({ 
      error: 'Internal server error. Please try again.',
      errorType: 'server'
    }, { status: 500 });
  }
}