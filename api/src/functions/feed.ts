import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { queryItems, saveItem, deleteItemById, getItemById } from '../shared/db';
import { FeedPost, FeedComment } from '../shared/types';

const CONTAINER = 'feed';

function getHouseholdId(req: HttpRequest): string {
  return (
    req.headers.get('x-household-id') ||
    req.query.get('householdId') ||
    'default_household'
  );
}

export async function feedHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = req.method;
  const householdId = getHouseholdId(req);

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-household-id'
  };

  if (method === 'OPTIONS') {
    return { status: 204, headers };
  }

  try {
    if (method === 'GET') {
      const allItems = await queryItems<FeedPost>(CONTAINER);
      const filtered = allItems.filter(
        p => p.householdId === householdId
      );

      // Sort pinned first, then by timestamp desc
      filtered.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.timestamp.localeCompare(a.timestamp);
      });
      return { status: 200, headers, body: JSON.stringify(filtered) };
    }

    if (method === 'POST') {
      const action = req.query.get('action');

      // Comment sub-action
      if (action === 'comment') {
        const body = (await req.json()) as { postId: string; authorId: string; content: string };
        const post = await getItemById<FeedPost>(CONTAINER, body.postId);
        if (!post) {
          return { status: 404, headers, body: JSON.stringify({ error: 'Post not found' }) };
        }

        const newComment: FeedComment = {
          id: `comm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          authorId: body.authorId,
          content: body.content,
          timestamp: new Date().toISOString()
        };

        if (!post.comments) post.comments = [];
        post.comments.push(newComment);
        await saveItem(CONTAINER, post);

        return { status: 201, headers, body: JSON.stringify(post) };
      }

      const data = (await req.json()) as Partial<FeedPost>;
      if (!data.content || !data.authorId) {
        return { status: 400, headers, body: JSON.stringify({ error: 'Content and authorId are required' }) };
      }

      const newPost: FeedPost = {
        id: data.id || `post_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        householdId: data.householdId || householdId,
        authorId: data.authorId,
        content: data.content,
        type: data.type || 'note',
        timestamp: data.timestamp || new Date().toISOString(),
        pinned: !!data.pinned,
        reactions: data.reactions || {},
        comments: data.comments || []
      };

      const saved = await saveItem<FeedPost>(CONTAINER, newPost);
      return { status: 201, headers, body: JSON.stringify(saved) };
    }

    if (method === 'PUT') {
      const data = (await req.json()) as FeedPost;
      if (!data.id) {
        return { status: 400, headers, body: JSON.stringify({ error: 'Post id is required for update' }) };
      }

      data.householdId = data.householdId || householdId;
      const updated = await saveItem<FeedPost>(CONTAINER, data);
      return { status: 200, headers, body: JSON.stringify(updated) };
    }

    if (method === 'DELETE') {
      const id = req.query.get('id');
      if (!id) {
        return { status: 400, headers, body: JSON.stringify({ error: 'Post id query parameter is required' }) };
      }

      const deleted = await deleteItemById(CONTAINER, id);
      return { status: 200, headers, body: JSON.stringify({ success: deleted, id }) };
    }

    return { status: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  } catch (error: any) {
    context.error('Error in feedHandler:', error);
    return { status: 500, headers, body: JSON.stringify({ error: error.message || 'Internal Server Error' }) };
  }
}

app.http('feed', {
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'feed',
  handler: feedHandler
});
