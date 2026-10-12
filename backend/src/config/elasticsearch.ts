import { Client } from '@elastic/elasticsearch';
import { config } from './env';
import { prisma } from './prisma';

export const esClient = new Client({
  node: config.ELASTICSEARCH_NODE,
});

export const EMAILS_INDEX = 'reachinbox_emails';

let isElasticsearchConnected = false;

export async function initElasticsearch(): Promise<boolean> {
  try {
    const health = await esClient.ping();
    if (health) {
      isElasticsearchConnected = true;
      console.log('✅ Connected to Elasticsearch successfully');

      const indexExists = await esClient.indices.exists({ index: EMAILS_INDEX });
      if (!indexExists) {
        await esClient.indices.create({
          index: EMAILS_INDEX,
          mappings: {
            properties: {
              id: { type: 'keyword' },
              userId: { type: 'keyword' },
              senderEmail: { type: 'keyword' },
              recipientEmail: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              subject: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              body: { type: 'text' },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
              etherealPreviewUrl: { type: 'keyword' },
              errorMessage: { type: 'text' },
              createdAt: { type: 'date' },
              updatedAt: { type: 'date' },
            },
          },
        } as any);
        console.log(`✅ Created Elasticsearch index: ${EMAILS_INDEX}`);
      } else {
        console.log(`ℹ️ Elasticsearch index ${EMAILS_INDEX} already exists`);
      }
      return true;
    }
  } catch (error: any) {
    isElasticsearchConnected = false;
    console.warn(`⚠️ Elasticsearch connection warning: ${error.message}. Search will fall back to PostgreSQL database.`);
  }
  return false;
}

export async function indexEmailDoc(email: any): Promise<void> {
  if (!isElasticsearchConnected) return;
  try {
    await esClient.index({
      index: EMAILS_INDEX,
      id: email.id,
      document: {
        id: email.id,
        userId: email.userId || null,
        senderEmail: email.senderEmail,
        recipientEmail: email.recipientEmail,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledAt: email.scheduledAt ? new Date(email.scheduledAt).toISOString() : null,
        sentAt: email.sentAt ? new Date(email.sentAt).toISOString() : null,
        etherealPreviewUrl: email.etherealPreviewUrl || null,
        errorMessage: email.errorMessage || null,
        createdAt: email.createdAt ? new Date(email.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      refresh: true,
    } as any);
  } catch (err: any) {
    console.warn(`Failed to index email ${email.id} into Elasticsearch:`, err.message);
  }
}

export async function searchEmails({
  query,
  status,
  userId,
  limit = 50,
  offset = 0,
}: {
  query?: string;
  status?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}) {
  if (isElasticsearchConnected) {
    try {
      const mustClauses: any[] = [];

      if (userId) {
        mustClauses.push({ term: { userId } });
      }

      if (status) {
        mustClauses.push({ term: { status } });
      }

      if (query && query.trim() !== '') {
        mustClauses.push({
          multi_match: {
            query: query.trim(),
            fields: ['recipientEmail^3', 'senderEmail^2', 'subject^2', 'body'],
            fuzziness: 'AUTO',
          },
        });
      } else if (mustClauses.length === 0) {
        mustClauses.push({ match_all: {} });
      }

      const esResult: any = await esClient.search({
        index: EMAILS_INDEX,
        from: offset,
        size: limit,
        query: {
          bool: {
            must: mustClauses,
          },
        },
        sort: [
          status === 'SENT' ? { sentAt: { order: 'desc' } } : { scheduledAt: { order: 'asc' } },
        ],
      } as any);

      const totalHits =
        typeof esResult.hits.total === 'number'
          ? esResult.hits.total
          : esResult.hits.total?.value || 0;

      const emails = esResult.hits.hits.map((hit: any) => hit._source);
      return {
        source: 'elasticsearch',
        total: totalHits,
        emails,
      };
    } catch (err: any) {
      console.warn('Elasticsearch search error, falling back to database:', err.message);
    }
  }

  // Graceful DB Fallback
  const whereClause: any = {};
  if (userId) whereClause.userId = userId;
  if (status) whereClause.status = status;
  if (query && query.trim() !== '') {
    const q = query.trim();
    whereClause.OR = [
      { recipientEmail: { contains: q, mode: 'insensitive' } },
      { senderEmail: { contains: q, mode: 'insensitive' } },
      { subject: { contains: q, mode: 'insensitive' } },
      { body: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [total, emails] = await Promise.all([
    prisma.emailJob.count({ where: whereClause }),
    prisma.emailJob.findMany({
      where: whereClause,
      take: limit,
      skip: offset,
      orderBy: status === 'SENT' ? { sentAt: 'desc' } : { scheduledAt: 'asc' },
    }),
  ]);

  return {
    source: 'postgres_fallback',
    total,
    emails,
  };
}

