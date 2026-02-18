import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';
import { generateReply } from '@/lib/ai';
import { sanitizeInput } from '@/lib/validation';

const MAX_CONTEXT_MESSAGES = 20;

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!checkRateLimit(currentUser.userId, 50, 60000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const body = await request.json();
    const { chatId, userMessage, imageUrl } = body;

    if (!chatId || !userMessage) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    if (chat.userId !== currentUser.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

    const aiReply = await generateReply(contextMessages);

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
  } catch (error) {
    console.error('AI generation error:', error);
    return NextResponse.json({ error: 'Failed to generate reply' }, { status: 500 });
  }
}