import Parser from 'rss-parser';

const parser = new Parser();

const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY || '';

interface NewsArticle {
  title: string;
  description: string;
  date: string;
  source: string;
}

async function fetchNewsDataIO(query: string): Promise<NewsArticle[]> {
  if (!NEWSDATA_API_KEY) {
    console.warn('NewsData.io API key not configured');
    return [];
  }

  try {
    const url = `https://newsdata.io/api/1/news?apikey=${NEWSDATA_API_KEY}&q=${encodeURIComponent(query)}&language=en&size=5`;
    const response = await fetch(url, { 
      next: { revalidate: 300 }
    });

    if (!response.ok) {
      console.error('NewsData.io API failed:', response.status);
      return [];
    }

    const data = await response.json();
    
    return (data.results || []).slice(0, 3).map((article: any) => ({
      title: article.title,
      description: article.description || '',
      date: new Date(article.pubDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      source: article.source_id || 'NewsData',
    }));
  } catch (error) {
    console.error('NewsData.io fetch error:', error);
    return [];
  }
}

async function fetchRSSFeeds(query: string): Promise<NewsArticle[]> {
  const feeds = [
    'http://feeds.bbci.co.uk/news/rss.xml',
    'https://www.theguardian.com/world/rss',
    'https://www.reuters.com/rssFeed/worldNews',
  ];

  const allArticles: NewsArticle[] = [];

  for (const feedUrl of feeds) {
    try {
      const feed = await parser.parseURL(feedUrl);
      const sourceName = feed.title || 'RSS Feed';
      
      const queryWords = query.toLowerCase().split(' ').filter(w => w.length > 3);
      
      const relevantArticles = (feed.items || [])
        .filter(item => {
          const text = `${item.title} ${item.contentSnippet || ''}`.toLowerCase();
          return queryWords.some(word => text.includes(word));
        })
        .slice(0, 2)
        .map(item => ({
          title: item.title || '',
          description: item.contentSnippet?.slice(0, 200) || '',
          date: item.pubDate 
            ? new Date(item.pubDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })
            : 'Recent',
          source: sourceName,
        }));

      allArticles.push(...relevantArticles);
    } catch (error) {
      console.error(`RSS feed error (${feedUrl}):`, error);
    }
  }

  return allArticles.slice(0, 3);
}

function needsCurrentInfo(query: string): boolean {
  const currentInfoKeywords = [
    'today', 'now', 'current', 'latest', 'recent', 'news',
    'happening', 'update', 'what is', 'who is', 'where is',
    'when', 'this week', 'this month', '2026', '2025',
    'stock', 'price', 'weather', 'score', 'result'
  ];

  const lowerQuery = query.toLowerCase();
  return currentInfoKeywords.some(keyword => lowerQuery.includes(keyword));
}

export async function getNewsContext(userMessage: string): Promise<string> {
  if (!needsCurrentInfo(userMessage)) {
    return '';
  }

  console.log('Fetching news context for:', userMessage);

  const [newsDataArticles, rssArticles] = await Promise.all([
    fetchNewsDataIO(userMessage),
    fetchRSSFeeds(userMessage),
  ]);

  const allArticles = [...newsDataArticles, ...rssArticles];

  if (allArticles.length === 0) {
    return '';
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let context = `\n\n--- CURRENT INFORMATION (${today}) ---\n`;
  context += `Latest news relevant to the query:\n\n`;

  allArticles.forEach((article, index) => {
    context += `${index + 1}. ${article.title}\n`;
    context += `   Source: ${article.source} | Date: ${article.date}\n`;
    if (article.description) {
      context += `   ${article.description}\n`;
    }
    context += `\n`;
  });

  context += `--- END CURRENT INFORMATION ---\n\n`;

  return context;
}