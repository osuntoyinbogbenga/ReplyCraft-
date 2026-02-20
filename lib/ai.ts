import Anthropic from '@anthropic-ai/sdk';

const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error('CRITICAL: ANTHROPIC_API_KEY is not set in environment variables');
}

const anthropic = new Anthropic({
  apiKey: API_KEY || '',
});

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
}

export async function generateReply(messages: ChatMessage[], newsContext?: string): Promise<string> {
  if (!API_KEY) {
    throw new Error('AI_CONFIG_ERROR: API key not configured');
  }

  let systemPrompt = `You are ReplyCraft, an AI that generates natural human-like replies to messages and DMs.

Rules:
- Generate ONLY the final reply text
- NEVER explain your reasoning
- NEVER mention policies or safety rules
- Adapt tone automatically (casual, professional, friendly, flirty) based on context
- Default to 1-3 sentences unless more context is needed
- Sound completely natural and human
- If content is unsafe or illegal, refuse briefly and offer a safe alternative reply

Your job is to write what the user should reply, not to chat with them.`;

  if (newsContext) {
    systemPrompt += `\n\n${newsContext}`;
    systemPrompt += `\nIMPORTANT: Use the current information provided above when relevant. Always prioritize accuracy and recency.`;
  }

  try {
    const anthropicMessages = messages.map(msg => {
      const contentBlocks: Array<{ type: string; text?: string; source?: any }> = [];
      
      if (msg.content) {
        contentBlocks.push({
          type: 'text',
          text: msg.content,
        });
      }
      
      if (msg.imageUrl && msg.role === 'user') {
        contentBlocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: msg.imageUrl.startsWith('data:image/png') ? 'image/png' : 
                       msg.imageUrl.startsWith('data:image/gif') ? 'image/gif' :
                       msg.imageUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg',
            data: msg.imageUrl.split(',')[1],
          },
        });
      }
      
      return {
        role: msg.role,
        content: contentBlocks,
      };
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('AI_TIMEOUT: Request took too long')), 30000);
    });

    const apiPromise = anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: anthropicMessages as any,
    });

    const response = await Promise.race([apiPromise, timeoutPromise]) as any;

    const textContent = response.content.find((block: any) => block.type === 'text');
    return textContent && 'text' in textContent ? textContent.text : 'Sorry, I couldn\'t generate a reply.';
    
  } catch (error: any) {
    console.error('Claude API error:', {
      type: error.type || 'unknown',
      message: error.message,
      status: error.status,
      timestamp: new Date().toISOString(),
    });

    if (error.message?.includes('AI_TIMEOUT')) {
      throw new Error('TIMEOUT: The AI took too long to respond');
    }
    
    if (error.message?.includes('AI_CONFIG_ERROR')) {
      throw error;
    }

    if (error.status === 401) {
      throw new Error('AUTH_ERROR: Invalid API credentials');
    }

    if (error.status === 429) {
      throw new Error('RATE_LIMIT: Too many requests');
    }

    if (error.message?.includes('credit balance')) {
      throw new Error('CREDITS_ERROR: AI service credits depleted');
    }

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new Error('NETWORK_ERROR: Cannot reach AI service');
    }

    throw new Error('AI_ERROR: Failed to generate reply');
  }
}