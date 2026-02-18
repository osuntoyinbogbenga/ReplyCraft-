import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
}

export async function generateReply(messages: ChatMessage[]): Promise<string> {
  const systemPrompt = `You are ReplyCraft, an AI that generates natural human-like replies to messages and DMs.

Rules:
- Generate ONLY the final reply text
- NEVER explain your reasoning
- NEVER mention policies or safety rules
- Adapt tone automatically (casual, professional, friendly, flirty) based on context
- Default to 1-3 sentences unless more context is needed
- Sound completely natural and human
- If content is unsafe or illegal, refuse briefly and offer a safe alternative reply

Your job is to write what the user should reply, not to chat with them.`;

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

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: anthropicMessages as any,
    });

    const textContent = response.content.find(block => block.type === 'text');
    return textContent && 'text' in textContent ? textContent.text : 'Sorry, I couldn\'t generate a reply.';
  } catch (error) {
    console.error('Claude API error:', error);
    throw new Error('Failed to generate reply');
  }
}