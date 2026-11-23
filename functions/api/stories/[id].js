import { json, bad } from '../../_lib/util.js';
import { loadStory } from '../../_lib/story.js';
export async function onRequestGet({ env, params }) {
  const row = await env.DB.prepare('SELECT * FROM stories WHERE id = ?').bind(parseInt(params.id, 10)).first();
  return row ? json(await loadStory(env, row)) : bad('no such story', 404);
}
